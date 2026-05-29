import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import { ICON_X } from './icons.js';
import { renderTranscript } from './transcript.js';

export type CallProps = {
  voiceState: 'idle' | 'connecting' | 'listening' | 'speaking' | 'muted';
  muted: boolean;
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  personaName: string;
  onClose: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  onCheckout: () => void;
};

function statusText(props: CallProps): string {
  if (props.muted) return "you're muted";
  if (props.voiceState === 'connecting') return `connecting to ${props.personaName}…`;
  if (props.voiceState === 'speaking') return `${props.personaName} is speaking…`;
  if (props.voiceState === 'listening') return `${props.personaName} is listening…`;
  // voiceState === 'idle': voice never connected or got reset. Don't lie
  // about Sage listening — the LiveKit room is down. Visitor can re-tap mic.
  return 'voice paused — tap mic to resume';
}

// Chrome key excludes voiceState — it changes during streaming and we update
// the status-line text in place rather than rebuilding the whole panel.
function chromeKey(props: CallProps): string {
  return `${props.checkoutUrl ?? ''}|${props.personaName}`;
}

export function renderCall(host: HTMLElement, props: CallProps): void {
  const key = chromeKey(props);
  if (host.dataset.chromeKey !== key) {
    host.innerHTML = `
      <div class="panel call-panel">
        <button class="panel-close" data-action="close" aria-label="${STRINGS.closeAria}">${ICON_X}</button>
        <div class="status-line" data-region="status">${statusText(props)}</div>
        <div class="transcript" data-region="transcript" aria-live="polite"></div>
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
  if (transcriptHost instanceof HTMLElement) {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
}
