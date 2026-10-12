import { logger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';

const env = voiceEnv();

logger.info(
  { livekit_url: env.LIVEKIT_URL, model: env.GEMINI_LIVE_MODEL },
  'voice-agent boot — env validated, registering worker',
);

const { startWorker, runVoiceSession } = await import('./agentWorker.js');
// Our own WebSocket voice transport (LiveKit replacement, per merchant).
const { startVoiceWsServer } = await import('./wsServer.js');
startVoiceWsServer(runVoiceSession);
startWorker();
