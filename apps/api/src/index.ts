import { serve } from '@hono/node-server';
import { mountWs } from '@shoppingmate/dom-harness';
import { env, logger } from '@shoppingmate/shared';
import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';
import { installRoute } from './routes/install.js';
import { slackRoute } from './routes/slack/index.js';

const app = new Hono();
app.route('/health', healthRoute);
app.route('/v1/install', installRoute);
app.route('/v1/slack', slackRoute);

const server = serve({ fetch: app.fetch, port: env.API_PORT }, ({ port }) => {
  logger.info({ port }, 'api listening');
});

// Plan 3d: server-side widget WebSocket. The DOMAdapter is constructed
// per-session with this transport in Plan 4 (session lifecycle); for 3d
// it's exercised by adapter-smoke + the worker DOM smoke harness.
mountWs(server);
