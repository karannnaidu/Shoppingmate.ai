import { cleanEnv, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
  }),
  DATABASE_URL: str(),
  REDIS_URL: str(),
  S3_ENDPOINT: str(),
  S3_REGION: str({ default: 'auto' }),
  S3_ACCESS_KEY_ID: str(),
  S3_SECRET_ACCESS_KEY: str(),
  S3_BUCKET: str(),
  API_PORT: port({ default: 3000 }),
  PUBLIC_API_BASE_URL: str({ default: '' }),
  OPENROUTER_API_KEY: str({ default: '' }),
  // Merchant id for the dogfood/demo widget on shoppingmate.ai itself. When
  // a session belongs to this merchant, the agent runs in demoMode (sells
  // shoppingmate, offers vertical tours) instead of as a generic store
  // shopping assistant.
  SHOPPINGMATE_DEMO_MERCHANT_ID: str({ default: 'SM-XPK2EN' }),
});

export type Env = typeof env;
