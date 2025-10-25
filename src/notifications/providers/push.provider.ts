import webPush from 'web-push';
import admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

export class PushProvider {
  private static configured = false;

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

  static async send(userId: string, title: string, body: string, data?: any) {
    // Implement token lookup and send via web-push or FCM as needed
  }
}
