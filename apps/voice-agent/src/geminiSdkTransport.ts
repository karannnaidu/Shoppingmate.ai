import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { childLogger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';
import { createInputFlusher } from './inputFlusher.js';
import { createTurnDetector } from './turnDetector.js';
import { type Hold, expectedSlot, utteranceHold } from './utteranceComplete.js';
import type { GeminiTransport, GeminiTransportEvent } from './geminiSession.js';

const log = childLogger({ mod: 'gemini-sdk' });

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

// When Gemini's ws closes UNEXPECTEDLY (code 1008 context-limit on a long call,
// an idle timeout while the visitor has muted, or the max session duration), the
// bot would otherwise go permanently dead: pushAudio hits a closed session and
// the worker's audio loop ends. We instead re-open a fresh session with the same
// voice + instruction so the call survives. The executor (OpenRouter side) keeps
// the full transcript, so the tool/form-fill path is unaffected — only Gemini's
// in-session conversational memory resets, hence the "already in progress, don't
// re-greet" note we prepend on reconnect.
const MAX_RECONNECTS = 3;
// Mic loudness (PCM16 RMS) that counts as speech, and how long after it the
// visitor still counts as talking.
const MIC_SPEECH_RMS = Number(process.env.MIC_SPEECH_RMS ?? 1200);
const MIC_SPEECH_HOLD_MS = 300;
const HEALTHY_RESET_MS = 60_000;
// No reply this long after the visitor's turn ended = the session stalled.
const STALL_MS = Number(process.env.GEMINI_STALL_MS ?? 4_000);

// The 2.5 native-audio models are the legacy path: Gemini's own VAD, thinking
// forced off. Newer live models (gemini-3.8-live, gemini-3.1-flash-live-*) use our turn
// detector, and must NOT get thinkingBudget 0 — measured 2026-10-27 it made
// 4 of 5 sessions stop answering after ~4 turns (0 of 5 without it, same speed).
export function isLegacyLiveModel(model: string): boolean {
  return /gemini-2\.5|gemini-live-2\.5/.test(model);
}

export function liveModelOptions(
  model: string,
  e: Record<string, string | undefined> = process.env,
): { manualTurns: boolean; thinking: { thinkingBudget: number } | null } {
  const legacy = isLegacyLiveModel(model);
  const mode = e.GEMINI_TURN_DETECTION;
  const manualTurns = mode === 'manual' ? true : mode === 'auto' ? false : !legacy;
  const t = e.GEMINI_THINKING_BUDGET;
  const thinking =
    t === 'default' ? null : t !== undefined && t !== '' ? { thinkingBudget: Number(t) } : legacy ? { thinkingBudget: 0 } : null;
  return { manualTurns, thinking };
}

export function createGeminiSdkTransport(): GeminiTransport {
  const env = voiceEnv();
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  // The newer live models share a small per-key quota (measured 2026-10-27:
  // ~2 concurrent Calmosis calls before turns get silently dropped). When the
  // primary stalls or reports a quota error, the call moves to the fallback
  // model (own quota, the long-proven 2.5) for the rest of the call.
  let model = env.GEMINI_LIVE_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-native-audio-latest';
  let { manualTurns, thinking } = liveModelOptions(model);
  const useFallback = (why: string): boolean => {
    if (!fallbackModel || model === fallbackModel) return false;
    log.warn({ from: model, to: fallbackModel, why }, 'switching this call to the fallback live model');
    model = fallbackModel;
    ({ manualTurns, thinking } = liveModelOptions(model));
    turns.reset();
    return true;
  };
  let session: LiveSession | null = null;
  const listeners: ((e: GeminiTransportEvent) => void)[] = [];
  const emitNow = (e: GeminiTransportEvent) => {
    // Olivia is audible from here (held audio isn't): drives the echo guard.
    if (e.type === 'audio_out') botUntil = Math.max(botUntil, Date.now()) + (e.bytes.length / 2 / 24_000) * 1000;
    for (const cb of listeners) cb(e);
  };
  // ---- smart end-of-turn hold (manual turns) ---------------------------------
  // The turn ends after a short pause and Gemini starts answering, but Olivia's
  // reply (audio + captions) is held until the visitor's transcript shows they
  // sounded finished. A finished sentence is released at once (the transcript
  // lands ~0.3s after the turn ends, well before her first audio at ~1s), so it
  // costs nothing. An unfinished one is held a little longer; if they carry on
  // talking, the held reply is dropped and both parts become one turn — for
  // Gemini and for the action layer. VOICE_SMART_TURNS=off disables it.
  const smartTurns = process.env.VOICE_SMART_TURNS !== 'off';
  const HOLD_MS: Record<Exclude<Hold, 'none'>, number> = {
    short: Number(process.env.VOICE_HOLD_SHORT_MS ?? 700),
    long: Number(process.env.VOICE_HOLD_LONG_MS ?? 1500),
    dictation: Number(process.env.VOICE_HOLD_DICTATION_MS ?? 2200),
  };
  let holding = false;
  // A turn that sounds finished is released at Olivia's first words (which
  // land with her first audio) — unless those words are her asking to repeat
  // ("sorry, I didn't catch that"): Gemini itself heard a fragment, so give
  // the visitor a moment to carry on before she says it.
  let awaitFirstWords = false;
  const CLARIFY = /^\W*(i'?m )?sorry[^.?!]{0,30}(didn'?t|did not|couldn'?t|could not|missed)|^\W*(could|can) you (please )?(repeat|say (that|it))|^\W*pardon/i;
  let held: GeminiTransportEvent[] = [];
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let turnText = '';
  // Olivia's latest words, and the line she'd said when the visitor started
  // answering (what she asked for: phone, pincode…).
  let lastBotLine = '';
  let questionLine = '';
  // A dropped held reply makes Gemini send "interrupted"; that's not a real
  // barge-in and must not cancel the action layer's work on the last turn.
  let ignoreInterruptUntil = 0;
  const clearHoldTimer = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };
  const release = (why: string) => {
    if (!holding) return;
    clearHoldTimer();
    holding = false;
    awaitFirstWords = false;
    log.info({ why, text: turnText.slice(0, 120), heldEvents: held.length }, 'turn settled');
    turnText = '';
    // The visitor's whole (possibly merged) utterance goes to captions + the
    // action layer first, then Olivia's reply plays.
    input.flushNow();
    const evs = held;
    held = [];
    for (const e of evs) emitNow(e);
  };
  // After the visitor carries on mid-thought, Gemini can still send a chunk of
  // its abandoned reply before it handles the interruption ("Sure! Here's our
  // full…" leaked between the halves in testing). Drop it until their
  // continued turn ends.
  let discardOutput = false;
  // Gemini blocks until every tool call gets a response — a dropped call froze
  // a test call ("OK, take me to checkout": calls made for "OK" were discarded
  // as the visitor carried on, and Gemini waited forever). Never drop one:
  // answer "skipped" so it re-decides with the visitor's full sentence.
  const skipTools = (calls: { id: string; name: string }[]) => {
    if (!session || calls.length === 0) return;
    log.info({ calls: calls.map((c) => c.name) }, 'tool calls skipped — visitor kept talking');
    session.sendToolResponse({
      functionResponses: calls.map((c) => ({
        id: c.id,
        name: c.name,
        response: {
          ok: false,
          skipped: true,
          reason: 'The visitor kept talking before this ran. Listen to everything they said, then call the tool again if it is still wanted.',
        },
      })),
    });
  };
  const emit = (e: GeminiTransportEvent) => {
    // Tool calls are part of Olivia's reply: a call made on a half-sentence is
    // held (and dropped if they carry on) like her audio.
    const output =
      e.type === 'audio_out' || e.type === 'bot_text_partial' || e.type === 'bot_text' || e.type === 'speech_ended' || e.type === 'tool_call';
    if (discardOutput && output) {
      if (e.type === 'tool_call') skipTools(e.calls);
      return;
    }
    if (holding && output) {
      held.push(e);
      if (awaitFirstWords) {
        if (e.type === 'tool_call') {
          release('acting');
        } else if (e.type === 'bot_text_partial' && e.text.trim().length >= 12) {
          if (CLARIFY.test(e.text)) {
            awaitFirstWords = false;
            log.info({ reply: e.text.slice(0, 60), text: turnText.slice(0, 120) }, 'olivia would ask to repeat — waiting for more');
            clearHoldTimer();
            holdTimer = setTimeout(() => release('waited after clarify'), HOLD_MS.long);
          } else {
            release('sounds finished');
          }
        }
      }
      return;
    }
    emitNow(e);
  };

  // Olivia's transcript accumulates across her turn (flushed on turnComplete).
  // The VISITOR's words go out as soon as they've finished speaking (see
  // inputFlusher) so cart/checkout actions start while Olivia is still
  // answering — not after her whole spoken reply.
  // Last moment the visitor's mic carried clear speech (see pushAudio).
  let lastLoudAt = 0;
  const input = createInputFlusher({
    // A held turn (still deciding if they're finished) must not be flushed by
    // the quiet fallback either — it goes out whole when it settles.
    stillSpeaking: () =>
      Date.now() - lastLoudAt < MIC_SPEECH_HOLD_MS || holding || discardOutput || (manualTurns && turns.active()),
    onPause: () => emit({ type: 'visitor_paused' }),
    emit: (text, meta) => emit({ type: 'final_transcript', text, ...meta }),
  });
  let outputBuf = '';

  // ---- our turn detection (manual activity) ---------------------------------
  // Olivia's audio is sent faster than real time; this estimates when it ends
  // playing so the detector's echo guard knows she is still talking.
  let botUntil = 0;
  let turnEndedAt = 0;
  let lastUserText = '';
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let stallStrikes = 0;
  // A stalled reply to re-ask after a forced reconnect.
  let pendingAnswer = '';
  let captionTimer: ReturnType<typeof setTimeout> | null = null;
  const clearStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
  };
  const gotReply = () => {
    clearStall();
    stallStrikes = 0;
    if (turnEndedAt) {
      log.info({ ms_reply: Date.now() - turnEndedAt, model }, 'turn → first reply');
      turnEndedAt = 0;
    }
  };
  const armStall = () => {
    clearStall();
    stallTimer = setTimeout(() => {
      stallTimer = null;
      // No words heard (a cough, a door): Olivia staying quiet is correct.
      if (!session || intentionalClose || !lastUserText) return;
      // Seen on the 3.x live previews (2026-10-27): mid-call, the model takes
      // a turn and never answers it — nor anything after. Re-asking in the
      // same session never helped; a fresh session (recent conversation in its
      // instruction) answers the same question in ~1.5s. So reconnect and
      // re-ask there (onclose path). Bounded by the reconnect budget.
      stallStrikes += 1;
      log.warn({ strike: stallStrikes, model, text: lastUserText.slice(0, 80) }, 'gemini stalled after the visitor spoke — reconnecting');
      // Stalls track the key's quota for this model: retrying the same model
      // tends to stall again, so continue on the fallback.
      useFallback('stall');
      pendingAnswer = lastUserText;
      try {
        session.close();
      } catch {
        /* already closing */
      }
    }, STALL_MS);
  };
  // END CONFIRMATION: Gemini sometimes loses the transcript of an activity that
  // starts within a few hundred ms of the previous one ending (prod 2026-10-27:
  // "…Bangalore. [pause] Pincode 560038" — the pincode never arrived). So the
  // end of a turn is only sent after a further VOICE_END_CONFIRM_MS of quiet;
  // if the visitor resumes inside it, the turn simply continues.
  const END_CONFIRM_MS = Number(process.env.VOICE_END_CONFIRM_MS ?? 250);
  let pendingEnd: ReturnType<typeof setTimeout> | null = null;
  // While Olivia waits for a phone number / address / email / pincode, people
  // pause between digit groups and address parts: allow a longer pause.
  const DICTATION_END_SILENCE_MS = Number(process.env.VOICE_DICTATION_SILENCE_MS ?? 900);
  const finishTurn = (reason: 'silence' | 'max', info: { turnMs: number; peakRms: number }) => {
    pendingEnd = null;
    if (!session || !manualTurns) return;
    session.sendRealtimeInput({ activityEnd: {} });
    turnEndedAt = Date.now();
    log.info({ reason, ms: Math.round(info.turnMs), peakRms: Math.round(info.peakRms) }, 'turn end');
    if (reason === 'max') log.warn('visitor turn hit the max length — closed it');
    if (discardOutput) {
      discardOutput = false;
      outputBuf = '';
    }
    if (smartTurns) {
      holding = true;
      clearHoldTimer();
      // No transcript at all (a cough): don't hold Olivia back for long.
      holdTimer = setTimeout(() => release('no transcript'), 900);
    }
    if (model !== fallbackModel) armStall();
  };
  const turns = createTurnDetector({
    endSilenceMs: Number(process.env.VOICE_END_SILENCE_MS ?? 500),
    minRms: Number(process.env.VOICE_VAD_MIN_RMS ?? 150),
    // Barge-in over Olivia: 2× the speech level (was 3×: a quiet visitor
    // talking over her went unheard in testing) for 200ms.
    duckMult: Number(process.env.VOICE_BARGE_MULT ?? 2),
    startMsWhileBot: Number(process.env.VOICE_BARGE_MS ?? 200),
    isBotSpeaking: () => Date.now() < botUntil + 200,
    onStart: (preroll, info) => {
      if (!session) return;
      if (pendingEnd) {
        // Resumed before the end was confirmed: same turn, no new activity.
        clearTimeout(pendingEnd);
        pendingEnd = null;
        log.info({ rms: Math.round(info.rms) }, 'visitor resumed — turn continues');
        for (const f of preroll) sendFrame(f);
        return;
      }
      clearStall();
      turnEndedAt = 0;
      const botSpeaking = Date.now() < botUntil + 200;
      if (holding) {
        // They carried on mid-thought: drop the reply Gemini started for the
        // fragment; the next activity interrupts it and both parts merge.
        log.info({ dropped: held.length, text: turnText.slice(0, 120) }, 'visitor continued — held reply dropped');
        skipTools(held.flatMap((h) => (h.type === 'tool_call' ? h.calls : [])));
        clearHoldTimer();
        holding = false;
        held = [];
        discardOutput = true;
        outputBuf = '';
        ignoreInterruptUntil = Date.now() + 1500;
      } else {
        questionLine = lastBotLine;
      }
      const slot = expectedSlot(questionLine);
      turns.setEndSilenceMs(slot && slot !== 'age' ? DICTATION_END_SILENCE_MS : 0);
      log.info({ rms: Math.round(info.rms), botSpeaking }, botSpeaking ? 'visitor barge-in (turn start while Olivia talks)' : 'turn start');
      session.sendRealtimeInput({ activityStart: {} });
      for (const f of preroll) sendFrame(f);
    },
    onAudio: (f) => sendFrame(f),
    onEnd: (reason, info) => {
      if (!session) return;
      if (pendingEnd) clearTimeout(pendingEnd);
      if (reason === 'max' || END_CONFIRM_MS <= 0) return finishTurn(reason, info);
      pendingEnd = setTimeout(() => finishTurn(reason, info), END_CONFIRM_MS);
    },
  });
  const sendFrame = (frame: Uint8Array) => {
    session?.sendRealtimeInput({
      audio: { data: Buffer.from(frame).toString('base64'), mimeType: 'audio/pcm;rate=16000' },
    });
  };

  // Reconnect state.
  let voiceId = '';
  let baseInstruction = '';
  let getResumeContext: (() => string) | undefined;
  let tools: unknown[] | undefined;
  let intentionalClose = false;
  let reconnects = 0;
  let healthyTimer: ReturnType<typeof setTimeout> | null = null;
  const clearHealthyTimer = () => {
    if (healthyTimer) {
      clearTimeout(healthyTimer);
      healthyTimer = null;
    }
  };

  async function connect(instruction: string): Promise<void> {
    session = await client.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: instruction }] },
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
        // One-brain mode only — and never on the 2.5 fallback, which keeps the
        // old talk-only path (its executor side-channel isn't running then).
        ...(tools && manualTurns ? { tools: tools as never } : {}),
        // Opt-in transcripts: without these the server returns no transcripts
        // at all, so the widget never sees the visitor's words or Sage's reply
        // text. The API rejects a `languageCodes` field here, so we pass empty
        // configs and let the server auto-detect.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // VAD tuning: START sensitivity LOW so ambient chatter doesn't register
        // as the visitor speaking; END HIGH + 500ms silence so the turn still
        // commits promptly once they actually finish.
        realtimeInputConfig: manualTurns
          ? { automaticActivityDetection: { disabled: true } }
          : {
          automaticActivityDetection: {
            disabled: false,
            // START = HIGH so the bot reliably HEARS the visitor (esp. softer /
            // accented onsets) and so barge-in works DURING the bot's own speech
            // (incl. the intro) — visitor can talk over it. Was LOW (2026-06-15,
            // to dodge background voices), but that dropped words + blocked
            // barge-in; echoCancellation + noiseSuppression now handle noise.
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            // END = LOW so a brief mid-sentence pause (common in accented/slower
            // speech) doesn't prematurely end the turn and cut the visitor off.
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            // 300ms (was 20) keeps enough audio BEFORE detected speech so the
            // first word isn't clipped before the model hears it.
            prefixPaddingMs: 300,
            silenceDurationMs: Number(process.env.GEMINI_SILENCE_MS ?? 600),
          },
        },
        // 2.5 native audio: thinking OFF (measured 2026-10-13 it added 3–4s
        // before every reply). Newer live models: left at their default — see
        // liveModelOptions. Tools/cart/checkout reasoning runs in the
        // side-channel executor, not here. GEMINI_THINKING_BUDGET overrides.
        ...(thinking ? { thinkingConfig: thinking } : {}),
        // Sliding-window context compression lets long conversations run without
        // hitting Gemini's session context limit (which otherwise terminates the
        // session mid-call: ws close 1008 "Operation is not implemented..."). It
        // doesn't fully prevent it on very long calls — the reconnect logic below
        // is the backstop. Gate via env to disable instantly (no redeploy) if the
        // native-audio model rejects the field.
        ...(process.env.GEMINI_CONTEXT_COMPRESSION === 'off'
          ? {}
          : { contextWindowCompression: { slidingWindow: {} } }),
      },
      callbacks: {
        onmessage: (msg) => {
          // Barge-in: when the visitor talks over Sage, the server VAD flags the
          // turn interrupted and stops generating. Surface it so the bridge can
          // flush any locally-buffered bot audio.
          if (msg.serverContent?.interrupted) {
            botUntil = 0;
            if (Date.now() < ignoreInterruptUntil) {
              ignoreInterruptUntil = 0;
              log.info('interrupted a held (unheard) reply — not a barge-in');
            } else {
              log.info({ heard: true }, 'olivia interrupted by the visitor');
              emit({ type: 'interrupted' });
            }
          }
          if (msg.toolCall?.functionCalls?.length) {
            gotReply();
            const calls = msg.toolCall.functionCalls.map((f) => ({
              id: String(f.id ?? ''),
              name: String(f.name ?? ''),
              args: (f.args ?? {}) as Record<string, unknown>,
            }));
            log.info({ calls: calls.map((c) => c.name), held: holding }, 'gemini tool call');
            emit({ type: 'tool_call', calls });
          }
          if (msg.toolCallCancellation?.ids?.length) {
            log.info({ ids: msg.toolCallCancellation.ids }, 'gemini tool call cancelled');
            emitNow({ type: 'tool_cancel', ids: msg.toolCallCancellation.ids.map(String) });
          }
          const inputXcript = msg.serverContent?.inputTranscription?.text;
          if (inputXcript) {
            input.push(inputXcript);
            lastUserText = `${lastUserText} ${inputXcript}`.replace(/\s+/g, ' ').trim();
            if (holding) {
              // Judge once the transcript for this turn has landed (it can come
              // in a couple of pieces).
              turnText = `${turnText} ${inputXcript}`.replace(/\s+/g, ' ').trim();
              clearHoldTimer();
              holdTimer = setTimeout(() => {
                const slot = expectedSlot(questionLine);
                const verdict = utteranceHold(turnText, slot);
                if (verdict === 'none') {
                  // Release at Olivia's first words (see awaitFirstWords).
                  awaitFirstWords = true;
                  clearHoldTimer();
                  holdTimer = setTimeout(() => release('sounds finished (timeout)'), 1_500);
                  return;
                }
                log.info({ verdict, slot, holdMs: HOLD_MS[verdict], text: turnText.slice(0, 120) }, 'turn sounds unfinished — holding reply');
                clearHoldTimer();
                holdTimer = setTimeout(() => release(`waited ${verdict}`), HOLD_MS[verdict]);
              }, 120);
            } else if (manualTurns && !turns.active()) {
              // Our detector already ended the turn, so this transcript is the
              // whole utterance (it arrives ~0.2s after): caption it now rather
              // than waiting for Olivia's first word.
              if (captionTimer) clearTimeout(captionTimer);
              captionTimer = setTimeout(() => {
                captionTimer = null;
                if (!turns.active()) input.flushNow();
              }, 150);
            }
          }
          const outputXcript = msg.serverContent?.outputTranscription?.text;
          // Olivia started answering → the visitor's turn is over: act on it now.
          if (outputXcript || msg.serverContent?.modelTurn?.parts?.length) {
            // While a turn is held, its words go out when it settles instead.
            if (!holding && !discardOutput && !turns.active()) input.flushNow();
            gotReply();
            lastUserText = '';
          }
          if (outputXcript) {
            outputBuf += outputXcript;
            lastBotLine = outputBuf;
            // Stream the running bot transcript so the widget caption keeps sync
            // with the audio instead of waiting for turnComplete.
            emit({ type: 'bot_text_partial', text: outputBuf });
          }
          // Native-audio models emit audio via modelTurn.parts[].inlineData.
          const audioPart = msg.serverContent?.modelTurn?.parts?.find(
            (p) => p.inlineData?.mimeType?.startsWith('audio/'),
          );
          if (audioPart?.inlineData?.data) {
            const bytes = Buffer.from(audioPart.inlineData.data, 'base64');
            emit({ type: 'audio_out', bytes });
          }
          if (msg.serverContent?.turnComplete) {
            if (!holding && !discardOutput && !turns.active()) input.flushNow(); // anything said late in the turn
            if (outputBuf.trim()) emit({ type: 'bot_text', text: outputBuf.trim() });
            outputBuf = '';
            emit({ type: 'speech_ended' });
          }
        },
        onerror: (err: unknown) => {
          const e = err as { error?: unknown; message?: string };
          log.error({ err: e?.error ?? err, message: e?.message }, 'gemini live ws error');
          emit({ type: 'error', error: err as Error });
        },
        onopen: () => {
          log.info('gemini live ws open');
          // Treat the session as healthy after a quiet window and reset the
          // reconnect budget — so a long call can recover many times, while a
          // tight close→reconnect→close loop still exhausts the budget and stops.
          clearHealthyTimer();
          healthyTimer = setTimeout(() => {
            reconnects = 0;
          }, HEALTHY_RESET_MS);
        },
        onclose: (ev: unknown) => {
          const c = ev as { code?: number; reason?: string };
          log.info({ code: c?.code, reason: c?.reason, model }, 'gemini live ws closed');
          clearHealthyTimer();
          clearStall();
          if (intentionalClose) return;
          session = null;
          if (/quota|resource.?exhausted|rate.?limit/i.test(c?.reason ?? '')) useFallback('quota');
          // Frames of a half-sent turn went to the dead session; start clean.
          turns.reset();
          if (pendingEnd) clearTimeout(pendingEnd);
          pendingEnd = null;
          if (reconnects >= MAX_RECONNECTS) {
            log.error({ reconnects }, 'gemini reconnect budget exhausted — giving up');
            emit({
              type: 'error',
              error: new Error('gemini session closed (reconnect budget exhausted)'),
            });
            return;
          }
          reconnects += 1;
          const delay = 250 * reconnects;
          log.info({ reconnects, delay, code: c?.code }, 'gemini reconnecting after unexpected close');
          setTimeout(() => {
            // Re-ground the fresh session with a COMPACT recent transcript (the
            // full one is what overflowed in the first place), so the bot resumes
            // mid-conversation instead of blank — but doesn't immediately re-bloat.
            let ctx = '';
            try {
              ctx = getResumeContext?.() ?? '';
            } catch {
              ctx = '';
            }
            const resumeNote = ctx
              ? `${baseInstruction}\n\nCALL IN PROGRESS — you briefly reconnected. Do NOT greet, re-introduce yourself, or restart. Here is the recent conversation so you can continue seamlessly:\n${ctx}\nContinue naturally from where you left off; if you were collecting details, pick up at the next field.`
              : `${baseInstruction}\n\n(NOTE: this call is ALREADY IN PROGRESS after a brief reconnection — do NOT greet, re-introduce yourself, or restart; just continue helping the visitor from where you left off.)`;
            connect(resumeNote)
              .then(() => {
                // Recovering from a stall: ask the unanswered message again.
                if (pendingAnswer && session) {
                  session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: pendingAnswer }] }] });
                  pendingAnswer = '';
                  // Only the primary is watched; the fallback is the last resort.
                  if (manualTurns && model !== fallbackModel) armStall();
                }
              })
              .catch((err) => {
              log.error({ err }, 'gemini reconnect failed');
              emit({ type: 'error', error: err as Error });
            });
          }, delay);
        },
      },
    });
  }

  return {
    async open({ voiceId: vId, systemInstruction, getResumeContext: grc, tools: t }) {
      voiceId = vId;
      tools = t;
      baseInstruction = systemInstruction;
      getResumeContext = grc;
      intentionalClose = false;
      reconnects = 0;
      await connect(systemInstruction);
      log.info({ voiceId }, 'gemini live opened');
    },
    pushAudio(frame) {
      // Track speech on the (noise-suppressed) mic so a transcript stall
      // mid-sentence never hands half a sentence to the action layer.
      const aligned = frame.byteOffset % 2 === 0 ? frame : frame.slice();
      const s = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength >> 1);
      let sum = 0;
      for (let i = 0; i < s.length; i++) sum += (s[i] as number) * (s[i] as number);
      if (Math.sqrt(sum / Math.max(1, s.length)) > MIC_SPEECH_RMS) lastLoudAt = Date.now();
      // During a reconnect window `session` is null. DROP frames silently rather
      // than throw — otherwise the worker's `for await` audio loop ends and the
      // mic goes dead even after the session comes back.
      if (!session) return;
      if (manualTurns) {
        turns.push(frame);
        return;
      }
      session.sendRealtimeInput({
        media: {
          data: Buffer.from(frame).toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    },
    async speak(text) {
      // Skip grounding injections while reconnecting; best-effort.
      if (!session) return;
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }] });
    },
    interrupt() {
      // No-op on native-audio: server-side VAD handles barge-in automatically once
      // it sees the visitor's mic frames, so we don't need to signal anything.
      // Sending {turns:[],turnComplete:false} causes Gemini to spam
      // "Failed to parse client content" on every ActiveSpeakersChanged tick.
    },
    async close() {
      intentionalClose = true;
      clearHealthyTimer();
      clearStall();
      if (pendingEnd) clearTimeout(pendingEnd);
      pendingEnd = null;
      if (captionTimer) clearTimeout(captionTimer);
      input.dispose(); // never act on words after the visitor has hung up
      if (!session) return;
      session.close();
      session = null;
      log.info('gemini session closed');
    },
    onEvent(cb) {
      listeners.push(cb);
    },
    toolsActive: () => Boolean(tools) && manualTurns,
    respondTool(responses) {
      if (!session) return;
      session.sendToolResponse({ functionResponses: responses });
    },
  };
}
