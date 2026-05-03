// Server-side WS + auth — re-exported so callers (apps/api, CLI smoke,
// worker smoke) get a single import for the whole DOM transport pipe.
export { mountWs } from './wsServer.js';
export type { MountedWs } from './wsServer.js';
export { signWsToken, verifyWsToken } from './wsAuth.js';
export type { WsTokenPayload } from './wsAuth.js';
export { startHarness } from './harness.js';
export type { HarnessOptions, Harness } from './harness.js';
export { runWithHarness } from './runWithHarness.js';
export type { HarnessSetup } from './runWithHarness.js';
