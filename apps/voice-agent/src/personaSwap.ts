// Beat 2 of the demo tour: hot-swap the active Gemini voice mid-session so
// the visitor hears Sage → Stella → Sage. Gemini Live doesn't support a
// "change voiceId" call mid-session, so we close + reopen the transport.
import type { GeminiSession } from './geminiSession.js';

export type SwapOpts = {
  session: GeminiSession;
  reopen: () => Promise<void>;
};

export async function swapPersona(opts: SwapOpts): Promise<void> {
  await opts.session.close();
  await opts.reopen();
}
