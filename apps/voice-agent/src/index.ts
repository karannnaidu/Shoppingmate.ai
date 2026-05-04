import { logger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';

const env = voiceEnv();

logger.info(
  { livekit_url: env.LIVEKIT_URL, model: env.GEMINI_LIVE_MODEL },
  'voice-agent boot — env validated',
);

// Worker registration is wired in Phase F (agentWorker.ts).
// For now, log a heartbeat and exit cleanly when stdin closes (dev convenience).
process.stdin.on('close', () => {
  logger.info('voice-agent stdin closed — exiting');
  process.exit(0);
});
