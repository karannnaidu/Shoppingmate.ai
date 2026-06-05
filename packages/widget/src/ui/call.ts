import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import { ICON_MINUS } from './icons.js';
import { renderTranscript } from './transcript.js';

export type CallProps = {
  voiceState: 'idle' | 'connecting' | 'listening' | 'speaking' | 'muted';
  muted: boolean;
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  personaName: string;
  voiceError?: { code: string; message: string } | null;
  onClose: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  onCheckout: () => void;
};

function errorHint(code: string): string {
  switch (code) {
    case 'mic_policy_blocked':
      return 'Voice is disabled on this page — text chat still works.';
    case 'mic_denied':
      return 'Microphone blocked. Allow mic access in your browser, then tap Call.';
    case 'mic_unavailable':
      return 'No microphone found — check your audio device, then tap Call.';
    case 'connect_failed':
      return "Couldn't reach voice. Tap Call to retry.";
    default:
      return 'Tap Call to try again.';
  }
}

function statusText(props: CallProps): string {
  if (props.muted) return "you're muted";
  if (props.voiceState === 'connecting') return `connecting to ${props.personaName}…`;
  if (props.voiceState === 'speaking') return `${props.personaName} is speaking…`;
  if (props.voiceState === 'listening') return `${props.personaName} is listening…`;
  return `${props.personaName} is ready`;
}

// What the panel body shows is a function of the call lifecycle:
//   error          → the failed-call card ("Could not start the call…")
//   live + empty   → the "How can I help you?" prompt (matches the reference)
//   live + history → the live transcript
// The key captures only what changes the *shell* so streaming captions don't
// rebuild the panel (which would drop card images / cause flicker).
type Body = 'error' | 'prompt' | 'transcript';

function bodyFor(props: CallProps): Body {
  if (props.voiceState === 'idle' && props.voiceError) return 'error';
  if (props.transcript.length === 0) return 'prompt';
  return 'transcript';
}

function chromeKey(props: CallProps): string {
  return `${bodyFor(props)}|${props.checkoutUrl ?? ''}|${props.personaName}|${props.voiceError?.code ?? ''}`;
}

export function renderCall(host: HTMLElement, props: CallProps): void {
  const key = chromeKey(props);
  const body = bodyFor(props);
  if (host.dataset.chromeKey !== key) {
    const errorHtml =
      body === 'error'
        ? `
          <div class="call-error">
            <p class="call-error-title">${STRINGS.callFailedTitle}</p>
            <p class="call-error-hint">${errorHint(props.voiceError?.code ?? 'unknown')}</p>
          </div>`
        : '';

    const promptHtml =
      body === 'prompt'
        ? `
          <div class="call-prompt">
            <h2 class="call-prompt-heading">${STRINGS.callHelpHeading}</h2>
            <ul class="call-prompt-bullets">
              ${STRINGS.callBullets.map((b) => `<li>${b}</li>`).join('')}
            </ul>
          </div>`
        : '';

    const transcriptHidden = body !== 'transcript';

    host.innerHTML = `
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${STRINGS.closeAria}">${ICON_MINUS}</button>
        ${errorHtml}
        ${promptHtml}
        <div class="status-line ${body === 'error' ? 'hidden' : ''}" data-region="status">${statusText(props)}</div>
        <div class="transcript ${transcriptHidden ? 'hidden' : ''}" data-region="transcript" aria-live="polite"></div>
        ${props.checkoutUrl ? `<a class="checkout-cta" data-action="checkout" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
        <div class="panel-footer">${STRINGS.poweredBy}</div>
      </div>
    `;
    host.querySelector('[data-action="close"]')?.addEventListener('click', props.onClose);
    host.querySelector('[data-action="checkout"]')?.addEventListener('click', props.onCheckout);
    host.dataset.chromeKey = key;
  }

  const status = host.querySelector('[data-region="status"]');
  if (status instanceof HTMLElement) {
    const next = statusText(props);
    if (status.textContent !== next) status.textContent = next;
  }

  const transcriptHost = host.querySelector('[data-region="transcript"]');
  if (transcriptHost instanceof HTMLElement && body === 'transcript') {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
}
