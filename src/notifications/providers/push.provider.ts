import webPush from 'web-push';
import admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export class PushProvider {
  private static configured = false;
  private static supabase: SupabaseClient;

  static configure(config: ConfigService) {
    if (this.configured) return;
    const vapid = config.get('push.vapid');
    if (vapid?.publicKey && vapid?.privateKey) {
      webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    }
    const firebase = config.get('push.firebase');
    if (firebase?.projectId && !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebase.projectId,
          clientEmail: firebase.clientEmail,
          privateKey: firebase.privateKey,
        } as any),
      });
    }
    this.configured = true;
  }

  /** Initialise with Supabase credentials so the worker can look up tokens. */
  static init(env: { supabaseUrl: string; supabaseServiceKey: string }) {
    this.supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
  }

  static async send(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    if (!this.supabase) return;

    // 1. Look up device tokens for this user
    const { data: tokens } = await this.supabase
      .from('user_device_tokens')
      .select('id, token, provider')
      .eq('user_id', userId);

    if (!tokens?.length) return;

    // 2. Split by provider type
    const expoTokens = tokens.filter(
      (t) =>
        t.provider === 'expo' ||
        t.token.startsWith('ExponentPushToken') ||
        t.token.startsWith('ExpoPushToken'),
    );
    // Future: handle webpush / fcm tokens separately here

    // 3. Send via Expo Push API
    if (expoTokens.length) {
      await this.sendExpo(expoTokens, title, body, data);
    }
  }

  // ── Expo Push API ────────────────────────────────────────────

  private static async sendExpo(
    tokens: { id: string; token: string }[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      data: data ?? {},
      channelId: 'orders',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) return;

    const { data: tickets } = (await res.json()) as {
      data: ExpoPushTicket[];
    };

    // Clean up invalid tokens
    const tokensToRemove: string[] = [];
    tickets?.forEach((ticket, i) => {
      if (
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered'
      ) {
        tokensToRemove.push(tokens[i].id);
      }
    });

    if (tokensToRemove.length) {
      await this.supabase
        .from('user_device_tokens')
        .delete()
        .in('id', tokensToRemove);
    }
  }
}
