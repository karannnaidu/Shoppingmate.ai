// Plan 4 runtime — extracted from apps/api/src/agent/ in Plan 6 Phase A.
// Public surface used by apps/api (chat WS) and apps/voice-agent (voice bridge).

export {
  runTurn,
  type RunTurnDeps,
  type SessionStore,
  type RecommendationStore,
} from './runtime.js';
export {
  createSession,
  loadSession,
  saveSession,
  deleteSession,
  truncateHistory,
  SESSION_TTL_SECONDS,
  TOKEN_BUDGET,
} from './state.js';
export {
  checkCaps,
  CAP_TURNS,
  CAP_VOICE_MS,
  CAP_DURATION_MS,
  type CapReason,
  type CapStatus,
} from './caps.js';
export { decodeWidgetMessage, encodeAgentEvent } from './events.js';
export type {
  AgentEvent,
  AnthropicMessage,
  CardItem,
  Mode,
  SessionState,
  WidgetMessage,
} from './types.js';
export { buildToolSurface, dispatchTool, type ToolResultEnvelope } from './tools.js';
export { redactPii, segmentSay, stripPrices, type PriceHit } from './postprocess.js';
export { NoOpWSTransport } from './transport-noop.js';
export { replaySession } from './replay.js';
export {
  BRAND_KB_SLOT,
  buildSystemPrompt,
  type SystemPromptOpts,
} from './prompts/system.js';
export { PERSONAS, DEFAULT_PERSONA, lookupPersona, type Persona } from './prompts/persona-table.js';
export { buildVoiceSystemInstruction } from './prompts/voice-instructions.js';
export type {
  HostAction,
  HostActionResult,
  HostActionRequest,
  HostActionResponse,
  PricingQuote,
} from './host-actions.js';
export { PLANS, findPlan, type Plan } from './pricing/plans.js';
export { formatPlanSpeech, numberToWords } from './pricing/speech.js';
export { createTour, type Tour, type TourBeat, type TourState, type BeatPlan } from './demo-tour.js';
