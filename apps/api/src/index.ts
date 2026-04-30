import { serve } from '@hono/node-server';
import { env, logger } from '@shoppingmate/shared';
import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';
import { installRoute } from './routes/install.js';

const app = new Hono();
app.route('/health', healthRoute);
app.route('/v1/install', installRoute);

serve({ fetch: app.fetch, port: env.API_PORT }, ({ port }) => {
  logger.info({ port }, 'api listening');
});
