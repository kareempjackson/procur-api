export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  storage: {
    privateBucket: process.env.SUPABASE_PRIVATE_BUCKET || 'private',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  email: {
    postmarkApiKey: process.env.POSTMARK_API_KEY,
    fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@procur.com',
    logoUrl: process.env.LOGO_URL,
  },

  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    assetsUrl:
      process.env.EMAIL_ASSETS_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3001',
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || 'v1',
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  push: {
    vapid: {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT,
    },
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  },
  turnstile: {
    secret: process.env.TURNSTILE_SECRET,
  },
});
