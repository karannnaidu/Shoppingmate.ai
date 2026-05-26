import { cleanEnv, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
  }),
  DATABASE_URL: str(),
  REDIS_URL: str(),
  // S3 is only consumed by the api+worker (R2 brand assets). The web app
  // pulls @shoppingmate/shared transitively via @shoppingmate/jobs but
  // never touches S3, so failing the build on missing S3 vars is wrong.
  // Processes that genuinely need them will throw at runtime when they
  // construct the S3 client with empty creds — much clearer locality.
  S3_ENDPOINT: str({ default: '' }),
  S3_REGION: str({ default: 'auto' }),
  S3_ACCESS_KEY_ID: str({ default: '' }),
  S3_SECRET_ACCESS_KEY: str({ default: '' }),
  S3_BUCKET: str({ default: '' }),
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
