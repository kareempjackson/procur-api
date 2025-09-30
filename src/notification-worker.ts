import { startNotificationWorker } from './notifications/queue/notification.worker';

startNotificationWorker({
  redisUrl: process.env.REDIS_URL as string,
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
});
