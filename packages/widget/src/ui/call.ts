import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import { ICON_X } from './icons.js';
import { renderTranscript } from './transcript.js';

export type CallProps = {
  voiceState: 'idle' | 'listening' | 'speaking' | 'muted';
  muted: boolean;
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  personaName: string;
  onClose: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  onCheckout: () => void;
};

export function renderCall(host: HTMLElement, props: CallProps): void {
  const speaking = props.voiceState === 'speaking';
  const subText = props.muted
    ? "you're muted"
    : speaking
      ? `${props.personaName} is speaking…`
      : `${props.personaName} is listening…`;

  host.innerHTML = `
    <div class="panel call-panel">
      <button class="panel-close" data-action="close" aria-label="${STRINGS.closeAria}">${ICON_X}</button>
      <div class="status-line">${subText}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" data-action="checkout" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <div class="panel-footer">${STRINGS.poweredBy}</div>
    </div>
  `;
  const transcriptHost = host.querySelector('[data-region="transcript"]');
  if (transcriptHost instanceof HTMLElement) {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
  host.querySelector('[data-action="close"]')?.addEventListener('click', props.onClose);
  host.querySelector('[data-action="checkout"]')?.addEventListener('click', props.onCheckout);
}
