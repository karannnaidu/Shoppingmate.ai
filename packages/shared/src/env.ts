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
  OPENROUTER_API_KEY: str({ default: '' }),
  ELEVENLABS_API_KEY: str({ default: '' }),
  OPENAI_API_KEY: str({ default: '' }),
  GOOGLE_SAFE_BROWSING_API_KEY: str({ default: '' }),
});

export type Env = typeof env;
