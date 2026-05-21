import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';

export interface CreditNoteRefundContext {
  refundNumber: string;
  creditNoteNumber: string;
  amountCents: number;
  reason: string;
  reasonCode: string;
  refundMethod: 'card' | 'buyer_credit';
  cardLast4?: string | null;
  cardBrand?: string | null;
  processedAt: Date;
}

export interface CreditNotePdfResult {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class CreditNoteService {
  private readonly logger = new Logger(CreditNoteService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async generate(
    orderId: string,
    refund: CreditNoteRefundContext,
  ): Promise<CreditNotePdfResult> {
    const client = this.supabase.getClient();

    const { data: order, error: orderErr } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const { data: items } = await client
      .from('order_items')
      .select('product_name, quantity, unit_price, total_price')
      .eq('order_id', orderId);

    const { data: buyerOrg } = await client
      .from('organizations')
      .select('name, business_name, address')
      .eq('id', order.buyer_org_id)
      .single();

    const buyerName =
      (buyerOrg as { business_name?: string; name?: string } | null)
        ?.business_name ||
      (buyerOrg as { name?: string } | null)?.name ||
      'Buyer';
    const invoiceNumber =
      (order as { invoice_number?: string }).invoice_number ||
      order.order_number ||
      order.id;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    const colors = {
      pageBg: '#F2EFE6',
      text: '#000809',
      muted: '#6C715D',
      accent: '#CB5927',
      danger: '#B14315',
      border: '#E5E7EB',
      bg: '#FFFFFF',
    };

    const currency = order.currency || 'USD';
    const formatMoney = (cents: number) =>
      `${currency} ${(cents / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    const formatAmount = (value: number) =>
      `${currency} ${Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    return await new Promise<CreditNotePdfResult>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `procur-credit-note-${refund.creditNoteNumber}.pdf`,
        }),
      );
      doc.on('error', (err: Error) => reject(err));

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const pageWidth = pageRight - pageLeft;

      // Background
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.pageBg);
      doc.restore();

      // Header band
      doc
        .roundedRect(pageLeft, doc.y, pageWidth, 56, 12)
        .lineWidth(1)
        .strokeColor(colors.border)
        .fillColor(colors.bg)
        .fillAndStroke();

      const headerY = doc.y;
      doc
        .fillColor(colors.danger)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('CREDIT NOTE', pageLeft + 16, headerY + 18, {
          width: pageWidth - 32,
          align: 'left',
        });
      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(10)
        .text('Procur', pageLeft + 16, headerY + 18, {
          width: pageWidth - 32,
          align: 'right',
        });

      doc.y = headerY + 56 + 18;

      // Reference block
      const refY = doc.y;
      doc
        .fillColor(colors.text)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Credit note', pageLeft, refY)
        .text('Original invoice', pageLeft, refY + 14)
        .text('Refund reference', pageLeft, refY + 28)
        .text('Issued', pageLeft, refY + 42);

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(refund.creditNoteNumber, pageLeft + 110, refY)
        .text(invoiceNumber, pageLeft + 110, refY + 14)
        .text(refund.refundNumber, pageLeft + 110, refY + 28)
        .text(refund.processedAt.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }), pageLeft + 110, refY + 42);

      doc.y = refY + 70;

      // Billed-to
      doc
        .fillColor(colors.muted)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('REFUND ISSUED TO', pageLeft, doc.y);
      doc
        .fillColor(colors.text)
        .font('Helvetica')
        .fontSize(11)
        .text(buyerName, pageLeft, doc.y + 4);

      const billAddr = (buyerOrg as { address?: string } | null)?.address;
      if (billAddr) {
        doc.fillColor(colors.muted).fontSize(10).text(billAddr, pageLeft, doc.y + 4, {
          width: pageWidth / 2,
        });
      }
      doc.y += 24;

      // Items table
      const tableY = doc.y + 8;
      doc
        .moveTo(pageLeft, tableY)
        .lineTo(pageRight, tableY)
        .strokeColor(colors.border)
        .stroke();
      doc
        .fillColor(colors.muted)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('ORIGINAL ORDER ITEMS', pageLeft, tableY + 8);
      let y = tableY + 28;
      doc
        .fillColor(colors.text)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Item', pageLeft, y)
        .text('Qty', pageLeft + 280, y, { width: 40, align: 'right' })
        .text('Unit', pageLeft + 330, y, { width: 70, align: 'right' })
        .text('Total', pageRight - 80, y, { width: 80, align: 'right' });
      y += 14;
      doc
        .moveTo(pageLeft, y)
        .lineTo(pageRight, y)
        .strokeColor(colors.border)
        .stroke();
      y += 6;

      doc.font('Helvetica').fontSize(10);
      for (const item of items || []) {
        doc.fillColor(colors.text).text(item.product_name, pageLeft, y, {
          width: 270,
        });
        doc.text(String(item.quantity), pageLeft + 280, y, {
          width: 40,
          align: 'right',
        });
        doc.text(formatAmount(Number(item.unit_price)), pageLeft + 330, y, {
          width: 70,
          align: 'right',
        });
        doc.text(formatAmount(Number(item.total_price)), pageRight - 80, y, {
          width: 80,
          align: 'right',
        });
        y += 18;
      }

      doc.y = y + 6;
      doc
        .moveTo(pageLeft, doc.y)
        .lineTo(pageRight, doc.y)
        .strokeColor(colors.border)
        .stroke();
      doc.y += 10;

      // Refund block
      const refundBlockY = doc.y;
      doc
        .roundedRect(pageLeft, refundBlockY, pageWidth, 96, 8)
        .fillColor('#FFF3EE')
        .strokeColor(colors.accent)
        .fillAndStroke();

      doc
        .fillColor(colors.danger)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('REFUND', pageLeft + 16, refundBlockY + 14);

      const methodLabel =
        refund.refundMethod === 'card'
          ? `Refunded to card${
              refund.cardBrand && refund.cardLast4
                ? ` (${refund.cardBrand.toUpperCase()} ending in ${refund.cardLast4})`
                : ''
            }`
          : 'Issued as Procur credit';
      doc
        .fillColor(colors.text)
        .font('Helvetica')
        .fontSize(10)
        .text(methodLabel, pageLeft + 16, refundBlockY + 32);
      doc
        .fillColor(colors.muted)
        .fontSize(9)
        .text(`Reason: ${refund.reason}`, pageLeft + 16, refundBlockY + 50, {
          width: pageWidth - 200,
        });

      doc
        .fillColor(colors.danger)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(
          `- ${formatMoney(refund.amountCents)}`,
          pageRight - 180,
          refundBlockY + 30,
          { width: 164, align: 'right' },
        );

      doc.y = refundBlockY + 96 + 16;

      // Footer
      doc
        .fillColor(colors.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(
          `This credit note evidences a refund of ${formatMoney(refund.amountCents)} ${currency} processed on ${refund.processedAt.toLocaleDateString(
            'en-GB',
            { day: '2-digit', month: 'short', year: 'numeric' },
          )}. ${refund.refundMethod === 'card' ? 'Card refunds typically clear in 5-10 business days.' : 'The credit balance is available immediately on your Procur account.'} No further action is required.`,
          pageLeft,
          doc.y,
          { width: pageWidth, align: 'left' },
        );

      doc.end();
    });
  }
}
