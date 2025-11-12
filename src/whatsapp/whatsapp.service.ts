import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SessionStore } from './session.store';
import { AuthService } from '../auth/auth.service';
import { SellersService } from '../sellers/sellers.service';
import { SupabaseService } from '../database/supabase.service';
import * as bcrypt from 'bcryptjs';
import { OrderStatus } from '../sellers/dto/order.dto';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly phoneNumberId: string;
  private readonly token: string;
  private readonly apiBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly sessions: SessionStore,
    private readonly auth: AuthService,
    private readonly sellers: SellersService,
    private readonly supabase: SupabaseService,
  ) {
    // Read from env first, then from nested config
    this.phoneNumberId =
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ||
      this.config.get<string>('whatsapp.phoneNumberId') ||
      '';
    this.token =
      this.config.get<string>('WHATSAPP_TOKEN') ||
      this.config.get<string>('whatsapp.token') ||
      '';
    this.apiBase = `https://graph.facebook.com/v20.0/${this.phoneNumberId}`;
  }

  async handleWebhook(body: any) {
    if (!this.token || !this.phoneNumberId) {
      this.logger.error(
        `WhatsApp not configured: token or phoneNumberId missing. tokenSet=${!!this.token} idSet=${!!this.phoneNumberId}`,
      );
      return;
    }
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    if (!entry) return;
    const msg = entry.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const type = msg.type;
    const session = this.sessions.get(from);

    // Frictionless identify: hydrate session by phone number if not set
    if (!session.user) {
      await this.tryHydrateUserFromPhone(from);
      const after = this.sessions.get(from);
      // If user exists but needs quick OTP, we will have switched to signup_otp
      if (after.flow === 'signup_otp') {
        return;
      }
    }

    const buttonId = msg?.interactive?.button_reply?.id;
    const listId = msg?.interactive?.list_reply?.id;
    const text =
      msg.text?.body ||
      msg?.button?.text ||
      msg?.interactive?.button_reply?.title ||
      '';

    if (buttonId || listId) {
      const choice = buttonId || listId;
      await this.routeMenuChoice(from, choice);
      return;
    }

    if (type === 'image') {
      await this.handleImage(from, msg.image.id);
      return;
    }

    const lower = (text || '').trim().toLowerCase();
    if (lower === 'menu' || lower === 'help' || lower === 'hi') {
      await this.showMenu(from);
      return;
    }
    if (lower === 'upload') {
      await this.routeMenuChoice(from, 'menu_upload');
      return;
    }
    if (lower === 'signup' || lower === 'sign up') {
      await this.routeMenuChoice(from, 'menu_signup');
      return;
    }

    switch (session.flow) {
      case 'signup_name': {
        // Default to seller and farmers for WhatsApp signups
        this.sessions.set(from, {
          flow: 'signup_country',
          data: {
            name: text.trim(),
            accountType: 'seller',
            businessType: 'farmers',
          },
        });
        await this.sendCountryList(from);
        break;
      }
      case 'signup_country': {
        // Fallback if user typed text (not list)
        const country = this.mapCountry(text);
        if (!country) {
          await this.sendCountryList(from);
          break;
        }
        this.sessions.set(from, { data: { country } });
        const randomPwd = this.generateRandomPassword();
        await this.finishWhatsappSignup(from, randomPwd);
        break;
      }
      case 'signup_otp': {
        const code = text.trim();
        await this.verifyWhatsappOtp(from, code);
        break;
      }
      case 'upload_name':
        this.sessions.set(from, {
          flow: 'upload_price',
          data: { productName: text.trim() },
        });
        await this.sendText(from, 'Base price? (numbers only, e.g., 1500)');
        break;
      case 'upload_price':
        this.sessions.set(from, {
          flow: 'upload_photo',
          data: { price: Number(String(text).replace(/[^\\d.]/g, '')) },
        });
        await this.sendText(from, 'Send a product photo now.');
        break;
      case 'upload_desc':
        // No longer asking for description; go straight to photo
        this.sessions.set(from, { flow: 'upload_photo' });
        await this.sendText(from, 'Send a product photo now.');
        break;
      case 'upload_category':
        // No longer asking for category; go straight to photo
        this.sessions.set(from, { flow: 'upload_photo' });
        await this.sendText(from, 'Send a product photo now.');
        break;
      // ===== HARVESTS =====
      case 'harvest_crop':
        this.sessions.set(from, {
          flow: 'harvest_window',
          data: { crop: text.trim() },
        });
        await this.sendText(
          from,
          'Harvest window? (e.g., "2–3 weeks" or "Apr 10–20")',
        );
        break;
      case 'harvest_window':
        this.sessions.set(from, {
          flow: 'harvest_qty',
          data: { expected_harvest_window: text.trim() },
        });
        await this.sendText(from, 'Quantity? (numbers only)');
        break;
      case 'harvest_qty': {
        const qty = Number(String(text).replace(/[^0-9.]/g, ''));
        if (!isFinite(qty) || qty <= 0) {
          await this.sendText(
            from,
            'Please enter a valid number for quantity.',
          );
          break;
        }
        this.sessions.set(from, {
          flow: 'harvest_unit',
          data: { quantity: qty },
        });
        await this.sendUnitsList(from);
        break;
      }
      case 'harvest_unit':
        // handled by list reply via routeMenuChoice('unit_*')
        await this.sendUnitsList(from);
        break;
      case 'harvest_notes': {
        const s2 = this.sessions.get(from);
        const notes =
          (text || '').trim().toLowerCase() === 'skip'
            ? undefined
            : text.trim();
        const payload: any = {
          crop: s2.data.crop,
          expected_harvest_window: s2.data.expected_harvest_window,
          quantity: s2.data.quantity,
          unit: s2.data.unit,
          notes,
        };
        const user = s2.user;
        if (!user?.orgId || !user?.id) {
          await this.sendText(from, 'Please sign up first.');
          this.sessions.set(from, { flow: 'menu' });
          break;
        }
        try {
          await this.sellers.createHarvestRequest(user.orgId, payload, user.id);
          await this.sendText(
            from,
            `Harvest posted: ${payload.crop} ${payload.quantity} ${payload.unit}, window ${payload.expected_harvest_window} ✅`,
          );
          this.sessions.set(from, { flow: 'menu', data: {} });
          await this.showMenu(from);
        } catch (e) {
          this.logger.error('Harvest create failed', e as any);
          await this.sendText(
            from,
            'Failed to post harvest. Please try again.',
          );
        }
        break;
      }
      // ===== QUOTES =====
      case 'quote_unit_price': {
        const price = Number(String(text).replace(/[^0-9.]/g, ''));
        if (!isFinite(price) || price <= 0) {
          await this.sendText(from, 'Enter a valid unit price (e.g., 1500).');
          break;
        }
        this.sessions.set(from, {
          flow: 'quote_currency',
          data: { unit_price: price },
        });
        await this.sendButtons(from, 'Currency?', [
          { id: 'cur_usd', title: 'USD' },
          { id: 'cur_xcd', title: 'XCD' },
          { id: 'cur_ngn', title: 'NGN' },
        ]);
        break;
      }
      case 'quote_currency':
        // handled via button cur_*
        break;
      case 'quote_available_qty': {
        const qty = Number(String(text).replace(/[^0-9.]/g, ''));
        if (!isFinite(qty) || qty <= 0) {
          await this.sendText(from, 'Enter a valid available quantity.');
          break;
        }
        this.sessions.set(from, {
          flow: 'quote_delivery_date',
          data: { available_quantity: qty },
        });
        await this.sendText(from, 'Delivery date? (YYYY-MM-DD) or "skip"');
        break;
      }
      case 'quote_delivery_date': {
        const dd =
          (text || '').trim().toLowerCase() === 'skip'
            ? undefined
            : text.trim();
        this.sessions.set(from, {
          flow: 'quote_notes',
          data: { delivery_date: dd },
        });
        await this.sendText(from, 'Notes? (optional, type "skip" to continue)');
        break;
      }
      case 'quote_notes': {
        const s2 = this.sessions.get(from);
        const notes =
          (text || '').trim().toLowerCase() === 'skip'
            ? undefined
            : text.trim();
        const user = s2.user;
        const reqId = s2.data.request_id as string | undefined;
        const unit_price = s2.data.unit_price as number | undefined;
        const currency = s2.data.currency as string | undefined;
        const available_quantity = s2.data.available_quantity as
          | number
          | undefined;
        const delivery_date = s2.data.delivery_date as string | undefined;
        if (
          !user?.orgId ||
          !user?.id ||
          !reqId ||
          !unit_price ||
          !currency ||
          !available_quantity
        ) {
          await this.sendText(
            from,
            'Missing details to create quote. Please start again.',
          );
          this.sessions.set(from, { flow: 'menu', data: {} });
          break;
        }
        try {
          await this.sellers.createQuote(user.orgId, reqId, {
            unit_price,
            currency,
            available_quantity,
            delivery_date,
            notes,
          });
          await this.sendText(from, `Quote submitted for request ${reqId} ✅`);
          this.sessions.set(from, { flow: 'menu', data: {} });
          await this.showMenu(from);
        } catch (e) {
          this.logger.error('Create quote failed', e as any);
          await this.sendText(
            from,
            'Failed to submit quote. Please try again.',
          );
        }
        break;
      }
      // ===== HBR ACK =====
      case 'hbr_message': {
        const s2 = this.sessions.get(from);
        const msg =
          (text || '').trim().toLowerCase() === 'skip'
            ? undefined
            : text.trim();
        const user = s2.user;
        if (
          !user?.orgId ||
          !user?.id ||
          !s2.data.hbr_id ||
          typeof s2.data.hbr_can_fulfill !== 'boolean'
        ) {
          await this.sendText(
            from,
            'Missing details to acknowledge. Please try again.',
          );
          this.sessions.set(from, { flow: 'menu', data: {} });
          break;
        }
        try {
          await this.sellers.acknowledgeHarvestBuyerRequest(
            user.orgId,
            s2.data.hbr_id,
            user.id,
            { can_fulfill: s2.data.hbr_can_fulfill, seller_message: msg },
          );
          await this.sendText(from, `Acknowledged request ✅`);
          this.sessions.set(from, { flow: 'menu', data: {} });
          await this.showMenu(from);
        } catch (e) {
          this.logger.error('Ack HBR failed', e as any);
          await this.sendText(from, 'Failed to acknowledge. Please try again.');
        }
        break;
      }
      // ===== ORDERS =====
      case 'orders_list':
        await this.listPendingOrders(from);
        break;
      case 'order_accept_eta':
        this.sessions.set(from, {
          flow: 'order_accept_shipping',
          data: { estimated_delivery_date: (text || '').trim() || undefined },
        });
        await this.sendText(
          from,
          'Shipping method? (optional, type "skip" to continue)',
        );
        break;
      case 'order_accept_shipping': {
        const s2 = this.sessions.get(from);
        const shipping =
          (text || '').trim().toLowerCase() === 'skip'
            ? undefined
            : text.trim();
        const user = s2.user;
        const orderId = s2.data.order_id;
        if (!user?.orgId || !user?.id || !orderId) {
          await this.sendText(from, 'Missing details. Please try again.');
          this.sessions.set(from, { flow: 'menu', data: {} });
          break;
        }
        try {
          await this.sellers.acceptOrder(
            user.orgId,
            orderId,
            {
              seller_notes: undefined,
              estimated_delivery_date: s2.data.estimated_delivery_date,
              shipping_method: shipping,
            },
            user.id,
          );
          await this.sendText(from, `Order accepted ✅`);
          this.sessions.set(from, { flow: 'menu', data: {} });
          await this.showMenu(from);
        } catch (e) {
          this.logger.error('Accept order failed', e as any);
          await this.sendText(
            from,
            'Failed to accept order. Please try again.',
          );
        }
        break;
      }
      case 'order_reject_reason': {
        const s2 = this.sessions.get(from);
        const reason = (text || '').trim() || 'No reason provided';
        const user = s2.user;
        const orderId = s2.data.order_id;
        if (!user?.orgId || !user?.id || !orderId) {
          await this.sendText(from, 'Missing details. Please try again.');
          this.sessions.set(from, { flow: 'menu', data: {} });
          break;
        }
        try {
          await this.sellers.rejectOrder(
            user.orgId,
            orderId,
            { reason, seller_notes: undefined },
            user.id,
          );
          await this.sendText(from, `Order rejected ❌`);
          this.sessions.set(from, { flow: 'menu', data: {} });
          await this.showMenu(from);
        } catch (e) {
          this.logger.error('Reject order failed', e as any);
          await this.sendText(
            from,
            'Failed to reject order. Please try again.',
          );
        }
        break;
      }
      case 'order_update_status':
        // handled via routeMenuChoice('ost_*')
        break;
      case 'order_update_tracking': {
        const s2 = this.sessions.get(from);
        const user = s2.user;
        const orderId = s2.data.order_id;
        const status = s2.data.status as string;
        const tracking = (text || '').trim();
        if (!user?.orgId || !user?.id || !orderId || !status) {
          await this.sendText(from, 'Missing details. Please try again.');
          this.sessions.set(from, { flow: 'menu', data: {} });
          break;
        }
        try {
          const statusMap: Record<string, OrderStatus> = {
            pending: OrderStatus.PENDING,
            accepted: OrderStatus.ACCEPTED,
            rejected: OrderStatus.REJECTED,
            processing: OrderStatus.PROCESSING,
            shipped: OrderStatus.SHIPPED,
            delivered: OrderStatus.DELIVERED,
            cancelled: OrderStatus.CANCELLED,
            disputed: OrderStatus.DISPUTED,
          };
          await this.sellers.updateOrderStatus(
            user.orgId,
            orderId,
            {
              status: statusMap[status],
              tracking_number: tracking || undefined,
            },
            user.id,
          );
          await this.sendText(from, `Order updated to ${status} ✅`);
          this.sessions.set(from, { flow: 'menu', data: {} });
          await this.showMenu(from);
        } catch (e) {
          this.logger.error('Update order failed', e as any);
          await this.sendText(
            from,
            'Failed to update order. Please try again.',
          );
        }
        break;
      }
      // ===== TRANSACTIONS =====
      case 'tx_check_id': {
        const id = (text || '').trim();
        const s2 = this.sessions.get(from);
        const user = s2.user;
        if (!user?.orgId) {
          await this.sendText(from, 'Please sign up first.');
          this.sessions.set(from, { flow: 'menu' });
          break;
        }
        try {
          const tx = await this.sellers.getTransactionById(user.orgId, id);
          await this.sendText(
            from,
            `Transaction ${tx.transaction_number || id}: ${tx.status}, ${tx.amount} ${tx.currency}`,
          );
        } catch {
          await this.sendText(from, 'Transaction not found.');
        }
        this.sessions.set(from, { flow: 'menu', data: {} });
        await this.showMenu(from);
        break;
      }
      default:
        await this.showMenu(from);
        break;
    }
  }

  private async tryHydrateUserFromPhone(from: string) {
    try {
      const e164 = `+${from}`;
      const user = await this.supabase.findUserByPhoneNumber(e164);
      if (!user) return;
      const withOrg = await this.supabase.getUserWithOrganization(user.id);
      const orgId = withOrg?.organization_users?.[0]?.organization_id;
      const accountType =
        withOrg?.organization_users?.[0]?.organizations?.account_type;
      this.sessions.set(from, {
        user: {
          id: user.id,
          email: user.email,
          orgId,
          accountType,
          name: user.fullname,
        },
      });
      // If user not verified or prior code expired, re-issue OTP to refresh trust
      const exp = user.email_verification_expires
        ? new Date(user.email_verification_expires).getTime()
        : 0;
      const notVerified = !user.email_verified;
      const expiredCode = !exp || exp < Date.now();
      if (notVerified) {
        const otp = this.generateOtp();
        const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await this.supabase.updateUser(user.id, {
          email_verification_token: otp,
          email_verification_expires: expires,
        });
        this.sessions.set(from, { flow: 'signup_otp', data: { otp } });
        await this.sendText(
          from,
          `For security, verify your account. Your code is: ${otp}`,
        );
        await this.sendText(
          from,
          'Please reply with the 6-digit code to continue.',
        );
      }
    } catch (e) {
      this.logger.error('Hydrate by phone failed', e as any);
    }
  }

  private async routeMenuChoice(to: string, choice: string) {
    if (choice === 'menu_signup') {
      this.sessions.set(to, { flow: 'signup_name', data: {} });
      await this.sendText(
        to,
        'Let’s create your Procur account. What’s your full name?',
      );
      return;
    }
    if (choice === 'menu_harvest') {
      const s = this.sessions.get(to);
      if (!s.user?.orgId) {
        await this.sendText(to, 'Sign up to continue.');
        this.sessions.set(to, { flow: 'signup_name' });
        return;
      }
      this.sessions.set(to, { flow: 'harvest_crop', data: {} });
      await this.sendText(to, 'Crop?');
      return;
    }
    if (choice === 'menu_requests') {
      const s = this.sessions.get(to);
      if (!s.user?.orgId) {
        await this.sendText(to, 'Sign up to continue.');
        this.sessions.set(to, { flow: 'signup_name' });
        return;
      }
      await this.listOpenRequests(to);
      return;
    }
    if (choice === 'menu_orders') {
      const s = this.sessions.get(to);
      if (!s.user?.orgId) {
        await this.sendText(to, 'Sign up to continue.');
        this.sessions.set(to, { flow: 'signup_name' });
        return;
      }
      this.sessions.set(to, { flow: 'orders_list' });
      await this.listPendingOrders(to);
      return;
    }
    if (choice === 'menu_transactions') {
      const s = this.sessions.get(to);
      if (!s.user?.orgId) {
        await this.sendText(to, 'Sign up to continue.');
        this.sessions.set(to, { flow: 'signup_name' });
        return;
      }
      await this.sendButtons(to, 'Transactions:', [
        { id: 'tx_list_recent', title: 'List recent' },
        { id: 'tx_check', title: 'Check by ID' },
      ]);
      return;
    }
    if (
      choice === 'country_gd' ||
      choice === 'country_vc' ||
      choice === 'country_lc' ||
      choice === 'country_dm' ||
      choice === 'country_kn'
    ) {
      const countryMap: Record<string, string> = {
        country_gd: 'Grenada',
        country_vc: 'St. Vincent',
        country_lc: 'St Lucia',
        country_dm: 'Dominica',
        country_kn: 'St Kitts',
      };
      this.sessions.set(to, { data: { country: countryMap[choice] } as any });
      const randomPwd = this.generateRandomPassword();
      await this.finishWhatsappSignup(to, randomPwd);
      return;
    }
    if (choice.startsWith('unit_')) {
      const unit = choice.replace('unit_', '').replace('_', ' ');
      this.sessions.set(to, { flow: 'harvest_notes', data: { unit } });
      await this.sendText(to, 'Notes? (optional, type "skip" to continue)');
      return;
    }
    if (choice.startsWith('cur_')) {
      const cur = choice.replace('cur_', '').toUpperCase();
      this.sessions.set(to, {
        flow: 'quote_available_qty',
        data: { currency: cur },
      });
      await this.sendText(to, 'Available quantity?');
      return;
    }
    if (choice.startsWith('req_')) {
      const reqId = choice.substring(4);
      this.sessions.set(to, {
        flow: 'quote_unit_price',
        data: { request_id: reqId },
      });
      await this.sendText(to, 'Unit price?');
      return;
    }
    if (choice.startsWith('hbr_')) {
      const rId = choice.substring(4);
      this.sessions.set(to, { data: { hbr_id: rId } });
      await this.sendButtons(to, 'Can you fulfill this request?', [
        { id: 'hbr_yes', title: 'Yes' },
        { id: 'hbr_no', title: 'No' },
      ]);
      return;
    }
    if (choice === 'hbr_yes' || choice === 'hbr_no') {
      const can = choice === 'hbr_yes';
      this.sessions.set(to, {
        flow: 'hbr_message',
        data: { hbr_can_fulfill: can },
      });
      await this.sendText(to, 'Optional message? (type "skip" to continue)');
      return;
    }
    if (choice.startsWith('ord_')) {
      const orderId = choice.substring(4);
      this.sessions.set(to, { data: { order_id: orderId } });
      await this.sendButtons(to, 'Order actions:', [
        { id: 'ord_accept', title: 'Accept' },
        { id: 'ord_reject', title: 'Reject' },
        { id: 'ord_update', title: 'Update status' },
      ]);
      return;
    }
    if (choice === 'ord_accept') {
      this.sessions.set(to, { flow: 'order_accept_eta' });
      await this.sendText(
        to,
        'Estimated delivery date? (YYYY-MM-DD, optional)',
      );
      return;
    }
    if (choice === 'ord_reject') {
      this.sessions.set(to, { flow: 'order_reject_reason' });
      await this.sendText(to, 'Reason for rejection?');
      return;
    }
    if (choice === 'ord_update') {
      await this.sendButtons(to, 'Pick status:', [
        { id: 'ost_processing', title: 'Processing' },
        { id: 'ost_shipped', title: 'Shipped' },
        { id: 'ost_delivered', title: 'Delivered' },
      ]);
      return;
    }
    if (choice.startsWith('ost_')) {
      const status = choice.replace('ost_', '');
      this.sessions.set(to, { data: { status } });
      const s2 = this.sessions.get(to);
      if (status === 'shipped') {
        this.sessions.set(to, { flow: 'order_update_tracking' });
        await this.sendText(
          to,
          'Tracking number? (optional, press Enter to skip)',
        );
      } else {
        const user = s2.user;
        const orderId = s2.data.order_id;
        if (!user?.orgId || !user?.id || !orderId) {
          await this.sendText(to, 'Missing details.');
          this.sessions.set(to, { flow: 'menu', data: {} });
          return;
        }
        try {
          const statusMap: Record<string, OrderStatus> = {
            pending: OrderStatus.PENDING,
            accepted: OrderStatus.ACCEPTED,
            rejected: OrderStatus.REJECTED,
            processing: OrderStatus.PROCESSING,
            shipped: OrderStatus.SHIPPED,
            delivered: OrderStatus.DELIVERED,
            cancelled: OrderStatus.CANCELLED,
            disputed: OrderStatus.DISPUTED,
          };
          await this.sellers.updateOrderStatus(
            user.orgId,
            orderId,
            { status: statusMap[status] },
            user.id,
          );
          await this.sendText(to, `Order updated to ${status} ✅`);
        } catch (e) {
          this.logger.error('Update status failed', e as any);
          await this.sendText(to, 'Failed to update order.');
        }
        this.sessions.set(to, { flow: 'menu', data: {} });
        await this.showMenu(to);
      }
      return;
    }
    if (choice === 'tx_list_recent') {
      await this.listRecentTransactions(to);
      this.sessions.set(to, { flow: 'menu', data: {} });
      await this.showMenu(to);
      return;
    }
    if (choice === 'tx_check') {
      this.sessions.set(to, { flow: 'tx_check_id' });
      await this.sendText(to, 'Enter transaction ID:');
      return;
    }
    if (choice === 'menu_upload') {
      const s = this.sessions.get(to);
      if (!s.user?.orgId || s.user?.accountType !== 'seller') {
        await this.sendText(
          to,
          'Link your seller account first. Reply "signup" to create one or provide your registered email.',
        );
        this.sessions.set(to, { flow: 'signup_name' });
        return;
      }
      this.sessions.set(to, { flow: 'upload_name', data: {} });
      await this.sendText(to, 'Product name?');
      return;
    }
    await this.showMenu(to);
  }

  private async finishWhatsappSignup(from: string, passwordPlain: string) {
    const s = this.sessions.get(from);
    const name = s.data.name;
    const accountType = 'seller';
    const businessType = 'farmers';
    const country = (s.data.country as string) || '';
    const e164 = `+${from}`;
    const email = `wa_${from}@signup.local`;

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(passwordPlain, saltRounds);

    try {
      // Create user
      const user = await this.supabase.createUser({
        email,
        password: hashedPassword,
        fullname: name,
        individual_account_type: accountType,
        phone_number: e164,
        country,
        email_verification_token: null as any,
        email_verification_expires: null as any,
      } as any);

      // Create organization for buyer or seller
      const org = await this.supabase.createOrganization({
        name: `${name}'s Farm`,
        business_name: `${name}'s Farm`,
        account_type: accountType,
        business_type: businessType as any,
        country,
        phone_number: e164,
      } as any);
      await this.supabase.ensureCreatorIsOrganizationAdmin(user.id, org.id);
      this.sessions.set(from, {
        user: { id: user.id, email, orgId: org.id, accountType, name },
      });

      // Ask for Farmer's ID image before OTP
      this.sessions.set(from, { flow: 'signup_farmers_id' });
      await this.sendText(
        from,
        'Please upload a photo of your Farmer’s ID to continue.',
      );
    } catch (e) {
      this.logger.error('WhatsApp signup failed', e as any);
      await this.sendText(from, 'Sign-up failed. Please try again.');
    }
  }

  private async verifyWhatsappOtp(from: string, code: string) {
    const s = this.sessions.get(from);
    const expected = (s.data.otp as string) || '';
    if (!/^[0-9]{6}$/.test(code)) {
      await this.sendText(from, 'Please enter the 6-digit code we sent.');
      return;
    }
    if (code !== expected) {
      await this.sendText(from, 'That code does not match. Please try again.');
      return;
    }
    try {
      const verified = await this.supabase.verifyUserEmail(code);
      if (!verified) {
        await this.sendText(
          from,
          'The code is expired or invalid. Please start signup again.',
        );
        this.sessions.set(from, { flow: 'menu', data: {} });
        return;
      }
      await this.sendText(from, '✅ Verified! Your Procur account is ready.');
      this.sessions.set(from, { flow: 'menu', data: {} });
      await this.showMenu(from);
    } catch (e) {
      this.logger.error('OTP verify failed', e as any);
      await this.sendText(from, 'Verification failed. Please try again.');
    }
  }

  private async handleImage(from: string, mediaId: string) {
    const s = this.sessions.get(from);
    if (s.flow !== 'upload_photo' && s.flow !== 'signup_farmers_id') {
      await this.sendText(
        from,
        'Got your image. To upload a product, choose "Upload product" from the menu.',
      );
      return;
    }

    try {
      if (s.flow === 'signup_farmers_id') {
        const user = s.user;
        if (!user?.orgId || !user?.id) {
          await this.sendText(from, 'Please link your seller account first.');
          this.sessions.set(from, { flow: 'menu' });
          return;
        }
        const objectPath = `ids/farmers/${user.orgId}/${Date.now()}.jpg`;
        const savedPath = await this.saveWhatsappMediaToSupabase(
          mediaId,
          objectPath,
          'private',
          'image/jpeg',
          false,
        );
        await this.supabase.updateOrganization(user.orgId, {
          farmers_id: savedPath as any,
        });
        // Issue OTP after ID collected
        const otp = this.generateOtp();
        const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await this.supabase.updateUser(user.id, {
          email_verification_token: otp,
          email_verification_expires: expires,
        });
        this.sessions.set(from, { flow: 'signup_otp', data: { otp } });
        await this.sendText(from, `Your Procur verification code is: ${otp}`);
        await this.sendText(
          from,
          'Please reply with the 6-digit code to verify your account.',
        );
        return;
      }

      const publicUrl = await this.saveWhatsappMediaToSupabase(
        mediaId,
        `products/${from}/${Date.now()}.jpg`,
      );
      const user = s.user;
      if (!user?.orgId || !user?.id) {
        await this.sendText(from, 'Please link your seller account first.');
        this.sessions.set(from, { flow: 'menu' });
        return;
      }

      const dto: any = {
        name: s.data.productName,
        description: s.data.description, // optional
        short_description: s.data.description?.slice(0, 140), // optional
        base_price: s.data.price,
        currency: 'USD',
        category: 'general',
        status: 'active',
        stock_quantity: 1,
        unit_of_measurement: 'lb',
        images: [
          {
            image_url: publicUrl,
            is_primary: true,
            display_order: 0,
          },
        ],
      };

      const created = await this.sellers.createProduct(
        user.orgId,
        dto,
        user.id,
      );
      await this.sendText(from, `Product created: ${created.name} ✅`);
      this.sessions.set(from, { flow: 'menu', data: {} });
      await this.showMenu(from);
    } catch (e) {
      this.logger.error('Upload flow failed', e as any);
      await this.sendText(
        from,
        'Failed to save photo or create product. Try again.',
      );
    }
  }

  private async saveWhatsappMediaToSupabase(
    mediaId: string,
    objectPath: string,
    bucket: 'public' | 'private' = 'public',
    contentType: string = 'image/jpeg',
    makePublicUrl: boolean = true,
  ): Promise<string> {
    const meta = await this.waGet(
      `https://graph.facebook.com/v20.0/${mediaId}`,
    );
    const mediaUrl = meta.data.url as string;

    const file = await this.waGet(mediaUrl, 'arraybuffer');
    const bytes = Buffer.from(file.data);

    const isPublic = bucket === 'public';
    await this.supabase.ensureBucketExists(bucket, isPublic);
    const signed = await this.supabase.createSignedUploadUrl(
      bucket,
      objectPath,
    );
    await axios.put(signed.signedUrl, bytes, {
      headers: { 'Content-Type': contentType },
    });

    if (isPublic && makePublicUrl) {
      const supaUrl = this.config.get<string>('database.supabaseUrl')!;
      return `${supaUrl}/storage/v1/object/public/${objectPath}`;
    }
    return objectPath;
  }

  private async showMenu(to: string) {
    const s = this.sessions.get(to);
    if (s.user?.id) {
      const name = s.user.name || 'there';
      // Show two visible button messages so users don't have to tap "Actions"
      await this.sendButtons(to, `Welcome back, ${name}! Pick an action:`, [
        { id: 'menu_upload', title: 'Upload product' },
        { id: 'menu_harvest', title: 'Post harvest' },
        { id: 'menu_requests', title: 'Requests & quotes' },
      ]);
      // Secondary actions
      await this.sendButtons(to, 'More:', [
        { id: 'menu_orders', title: 'Orders' },
        { id: 'menu_transactions', title: 'Transactions' },
      ]);
    } else {
      await this.sendButtons(
        to,
        'Welcome to Procur on WhatsApp. Create your account to get started.',
        [{ id: 'menu_signup', title: 'Sign up' }],
      );
    }
  }

  private async sendCountryList(to: string) {
    await this.waPostMessages({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Select your country' },
        body: { text: 'Choose one from the list' },
        action: {
          button: 'Countries',
          sections: [
            {
              title: 'OECS',
              rows: [
                { id: 'country_gd', title: 'Grenada' },
                { id: 'country_vc', title: 'St. Vincent' },
                { id: 'country_lc', title: 'St Lucia' },
                { id: 'country_dm', title: 'Dominica' },
                { id: 'country_kn', title: 'St Kitts' },
              ],
            },
          ],
        },
      },
    });
  }

  private async sendUnitsList(to: string) {
    await this.waPostMessages({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Pick a unit' },
        body: { text: 'Choose unit of measure' },
        action: {
          button: 'Units',
          sections: [
            {
              title: 'Units',
              rows: [
                { id: 'unit_kg', title: 'kg' },
                { id: 'unit_lb', title: 'lb' },
                { id: 'unit_tonne', title: 'tonne' },
                { id: 'unit_sacks', title: 'sacks' },
                { id: 'unit_crates', title: 'crates' },
              ],
            },
          ],
        },
      },
    });
  }

  private async listOpenRequests(to: string) {
    const s = this.sessions.get(to);
    const user = s.user;
    if (!user?.orgId) return;
    const { requests } = await this.sellers.getProductRequests(user.orgId, {
      status: 'active',
      page: 1,
      limit: 5,
    } as any);
    const rows = (requests || []).map((r: any) => ({
      id: `req_${r.id}`,
      title: `${r.product_name} x${r.quantity}`,
      description: r.request_number,
    }));
    if (!rows.length) {
      await this.sendText(to, 'No open requests right now.');
      return;
    }
    await this.waPostMessages({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Open requests' },
        body: { text: 'Select a request to quote' },
        action: { button: 'Requests', sections: [{ title: 'Open', rows }] },
      },
    });
  }

  private async listPendingOrders(to: string) {
    const s = this.sessions.get(to);
    const user = s.user;
    if (!user?.orgId) return;
    const result = await this.sellers.getOrders(user.orgId, {
      status: 'pending',
      page: 1,
      limit: 5,
    } as any);
    const rows = (result.orders || []).map((o: any) => ({
      id: `ord_${o.id}`,
      title: `${o.order_number} • ${o.total_amount} ${o.currency}`,
      description: `${o.status} • items: ${o.items?.length || 0}`,
    }));
    if (!rows.length) {
      await this.sendText(to, 'No pending orders.');
      return;
    }
    await this.waPostMessages({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Pending orders' },
        body: { text: 'Select an order' },
        action: { button: 'Orders', sections: [{ title: 'Pending', rows }] },
      },
    });
  }

  private async listRecentTransactions(to: string) {
    const s = this.sessions.get(to);
    const user = s.user;
    if (!user?.orgId) return;
    const t = await this.sellers.getTransactions(user.orgId, {
      page: 1,
      limit: 5,
      sort_by: 'created_at',
      sort_order: 'desc',
    } as any);
    if (!t.transactions?.length) {
      await this.sendText(to, 'No recent transactions.');
      return;
    }
    const lines = t.transactions.map(
      (x: any) =>
        `${x.id || x.transaction_number}: ${x.amount} ${x.currency} • ${x.status}`,
    );
    await this.sendText(to, `Recent transactions:\n${lines.join('\n')}`);
  }

  private mapCountry(text: string): string | null {
    const t = (text || '').trim().toLowerCase();
    const options = [
      'grenada',
      'st. vincent',
      'st vincent',
      'st lucia',
      'dominica',
      'st kitts',
    ];
    if (!t) return null;
    if (t.includes('grenada')) return 'Grenada';
    if (t.includes('vincent')) return 'St. Vincent';
    if (t.includes('lucia')) return 'St Lucia';
    if (t.includes('dominica')) return 'Dominica';
    if (t.includes('kitts')) return 'St Kitts';
    return null;
  }

  private mapSellerBusinessType(input: string): string | null {
    const t = (input || '').toLowerCase();
    if (t.includes('general')) return 'general';
    if (t.includes('farmer') || t.includes('farmers')) return 'farmers';
    if (t.includes('manufacturer') || t.includes('manufacturers'))
      return 'manufacturers';
    if (t.includes('fisherman') || t.includes('fishermen')) return 'fishermen';
    return null;
  }

  private looksLikeEmail(s: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateRandomPassword(): string {
    // Generate strong random password for DB requirement; not asked from user
    return `Wa!${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  private getCurrentToken(): string {
    const latest =
      this.config.get<string>('WHATSAPP_TOKEN') ||
      this.config.get<string>('whatsapp.token') ||
      '';
    if (latest && latest !== this.token) {
      this.logger.log('WhatsApp token updated from configuration at runtime.');
      (this as any).token = latest;
    }
    return this.token;
  }

  private isExpiredTokenError(err: any): boolean {
    const status = err?.response?.status;
    const code = err?.response?.data?.error?.code;
    return status === 401 && code === 190;
  }

  private async waPostMessages(payload: any) {
    let token = this.getCurrentToken();
    try {
      return await axios.post(`${this.apiBase}/messages`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      if (this.isExpiredTokenError(err)) {
        // Re-read token (in case it was rotated) and retry once
        token = this.getCurrentToken();
        try {
          return await axios.post(`${this.apiBase}/messages`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err2: any) {
          this.logger.error('WhatsApp POST /messages retry failed', err2);
          throw err2;
        }
      }
      this.logger.error('WhatsApp POST /messages failed', err);
      throw err;
    }
  }

  private async waGet(url: string, responseType?: 'arraybuffer' | 'json') {
    let token = this.getCurrentToken();
    try {
      return await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: responseType as any,
      });
    } catch (err: any) {
      if (this.isExpiredTokenError(err)) {
        token = this.getCurrentToken();
        try {
          return await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: responseType as any,
          });
        } catch (err2: any) {
          this.logger.error('WhatsApp GET retry failed', err2);
          throw err2;
        }
      }
      this.logger.error('WhatsApp GET failed', err);
      throw err;
    }
  }

  private formatBody(body: string): string {
    const tip = `\n\nTip: Type "menu" anytime for options.`;
    return body.includes('Type "menu"') ? body : `${body}${tip}`;
  }

  private async sendButtons(
    to: string,
    body: string,
    buttons: { id: string; title: string }[],
  ) {
    if (!this.token || !this.phoneNumberId) {
      this.logger.error('Cannot send buttons: WhatsApp credentials missing');
      return;
    }
    await this.waPostMessages({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    });
  }

  private async sendText(to: string, body: string) {
    if (!this.token || !this.phoneNumberId) {
      this.logger.error('Cannot send text: WhatsApp credentials missing');
      return;
    }
    await this.waPostMessages({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: this.formatBody(body) },
    });
  }
}
