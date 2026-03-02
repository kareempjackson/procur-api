import { Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import * as Sentry from '@sentry/node';

function getToken(): string {
  return process.env.WHATSAPP_TOKEN || '';
}

function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
}

function isExpiredTokenError(err: any): boolean {
  const status = err?.response?.status;
  const code = err?.response?.data?.error?.code;
  return status === 401 && code === 190;
}

export function startWaWorker(env: { redisUrl?: string }) {
  const connection = env.redisUrl
    ? new IORedis(env.redisUrl, { maxRetriesPerRequest: null })
    : new IORedis({ maxRetriesPerRequest: null });
  const apiBase = `https://graph.facebook.com/v24.0/${getPhoneNumberId()}`;

  const processor = async (job: Job) => {
    if (job.name === 'send') {
      const payload = job.data?.payload;
      const meta = job.data?.meta || {};
      if (!payload) return;
      // Try dynamic token from Redis first, fallback to env
      let token = (await connection.get('wa:token')) || getToken();
      try {
        await axios.post(`${apiBase}/messages`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return;
      } catch (err: any) {
        const code = err?.response?.data?.error?.code;
        const subcode = err?.response?.data?.error?.error_subcode;
        const errMsg = err?.response?.data?.error?.message;
        if (code || subcode) {
          console.error(
            JSON.stringify({ level: 'error', ctx: 'wa_worker', code, subcode, message: errMsg, meta }),
          );
          // Report non-token-expiry errors to Sentry
          if (!isExpiredTokenError(err)) {
            Sentry.captureException(err, { extra: { code, subcode, meta } });
          }
        }
        if (isExpiredTokenError(err)) {
          token = (await connection.get('wa:token')) || getToken();
          await axios.post(`${apiBase}/messages`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return;
        }
        throw err;
      }
    }
  };

  const worker = new Worker('wa-send', processor, { connection });
  new QueueEvents('wa-send', { connection });

  // Capture jobs that exhaust all retries
  worker.on('failed', (job, err) => {
    const meta = job?.data?.meta || {};
    console.error(
      JSON.stringify({ level: 'error', ctx: 'wa_worker_failed', jobId: job?.id, meta, error: String(err) }),
    );
    Sentry.captureException(err, { extra: { jobId: job?.id, meta } });
  });

  return worker;
}
