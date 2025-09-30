export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  email: {
    postmarkApiKey: process.env.POSTMARK_API_KEY,
    fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@procur.com',
  },

  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || 'v1',
  },
});
