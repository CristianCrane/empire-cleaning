// the environment every test run starts from (vitest.config.ts,
// vitest.sandbox.config.ts)
export const testEnv = {
  APP_MODE: "dev",
  CORS_ORIGIN_URL: "http://localhost:5173",
  LANDING_ORIGIN_URL: "http://localhost:4321",
  // fake credentials: the services behind them are faked in tests, and
  // Google only needs them to build sign-in URLs
  RESEND_API_KEY: "test-resend-api-key",
  OFFICE_EMAIL: "office@example.com",
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  STRIPE_SECRET_KEY: "test-stripe-secret-key",
  STRIPE_PUBLISHABLE_KEY: "test-stripe-publishable-key",
  STRIPE_WEBHOOK_SECRET: "test-stripe-webhook-secret",
  // what would be logged is in testMonitoring(); the scrubbing tests
  // write to a logger of their own
  LOG_LEVEL: "silent",
};
