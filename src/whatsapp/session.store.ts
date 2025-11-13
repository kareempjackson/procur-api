import { Injectable } from '@nestjs/common';

type Flow =
  | 'idle'
  | 'menu'
  | 'signup_name'
  | 'signup_account_type'
  | 'signup_country'
  | 'signup_farmers_id'
  | 'signup_otp'
  // Products
  | 'upload_name'
  | 'upload_price'
  | 'upload_desc'
  | 'upload_category'
  | 'upload_photo'
  | 'upload_price_confirm';

// Extended flows for features
export type ExtendedFlow =
  | Flow
  // Harvests
  | 'harvest_crop'
  | 'harvest_window'
  | 'harvest_qty'
  | 'harvest_unit'
  | 'harvest_notes'
  // Requests & Quotes
  | 'quote_unit_price'
  | 'quote_currency'
  | 'quote_available_qty'
  | 'quote_delivery_date'
  | 'quote_notes'
  // Harvest buyer request acknowledge
  | 'hbr_message'
  // Orders
  | 'orders_list'
  | 'order_accept_eta'
  | 'order_accept_shipping'
  | 'order_reject_reason'
  | 'order_update_status'
  | 'order_update_tracking'
  // Transactions
  | 'tx_check_id';

export interface Session {
  flow: ExtendedFlow;
  data: Record<string, any>;
  user?: {
    id: string;
    email?: string;
    orgId?: string;
    accountType?: string;
    name?: string;
  };
  updatedAt: number;
}

@Injectable()
export class SessionStore {
  private store = new Map<string, Session>();
  private ttlMs = 1000 * 60 * 30;

  get(id: string): Session {
    const s = this.store.get(id);
    if (!s || Date.now() - s.updatedAt > this.ttlMs) {
      const fresh: Session = { flow: 'menu', data: {}, updatedAt: Date.now() };
      this.store.set(id, fresh);
      return fresh;
    }
    return s;
  }

  set(id: string, patch: Partial<Session>) {
    const cur = this.get(id);
    const next = {
      ...cur,
      ...patch,
      data: { ...cur.data, ...(patch.data || {}) },
      updatedAt: Date.now(),
    };
    // Keep a simple single-step history for undo
    const modifies =
      typeof patch.flow !== 'undefined' || typeof patch.data !== 'undefined';
    if (modifies) {
      next.data._prev = {
        flow: cur.flow,
        data: { ...cur.data },
      };
    }
    this.store.set(id, next);
    return next;
  }

  clear(id: string) {
    this.store.delete(id);
  }
}
