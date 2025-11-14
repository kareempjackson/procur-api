import { Injectable } from '@nestjs/common';
import { WaQueue } from '../wa.queue';

@Injectable()
export class SendService {
  constructor(private readonly queue: WaQueue) {}

  private truncate(input: string, max: number): string {
    const s = String(input || '');
    if (s.length <= max) return s;
    if (max <= 1) return s.slice(0, max);
    return s.slice(0, max - 1) + '…';
  }

  async text(to: string, body: string) {
    await this.queue.enqueueSendMessage({
      payload: {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      },
      meta: { kind: 'text' },
    });
  }

  async buttons(
    to: string,
    body: string,
    buttons: { id: string; title: string }[],
  ) {
    const safe = buttons.slice(0, 3);
    await this.queue.enqueueSendMessage({
      payload: {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: safe.map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: this.truncate(b.title, 20) },
            })),
          },
        },
      },
      meta: { kind: 'buttons' },
    });
  }

  async list(
    to: string,
    header: string,
    body: string,
    button: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
  ) {
    const safeSections = sections.map((sec) => ({
      title: this.truncate(sec.title, 24),
      rows: sec.rows.map((r) => ({
        id: r.id,
        title: this.truncate(r.title, 24),
        description: r.description
          ? this.truncate(r.description, 60)
          : undefined,
      })),
    }));
    await this.queue.enqueueSendMessage({
      payload: {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: header },
          body: { text: body },
          action: { button, sections: safeSections as any },
        },
      },
      meta: { kind: 'list' },
    });
  }
}
