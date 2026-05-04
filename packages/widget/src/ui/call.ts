import { STRINGS } from '../strings.js';
import type { TranscriptItem } from '../state/store.js';
import { renderTranscript } from './transcript.js';

export type CallProps = {
  voiceState: 'idle' | 'listening' | 'speaking' | 'muted';
  muted: boolean;
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  onMute: (next: boolean) => void;
  onEnd: () => void;
  onChat: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  onCheckout: () => void;
};

export function renderCall(host: HTMLElement, props: CallProps): void {
  const speaking = props.voiceState === 'speaking';
  const subText = props.muted
    ? "you're muted"
    : speaking
      ? `Sage is ${STRINGS.callHeaderSpeaking}…`
      : `${STRINGS.callHeaderListening} to you…`;
  host.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">on call · ${speaking ? STRINGS.callHeaderSpeaking : STRINGS.callHeaderListening}</div>
          </div>
        </div>
      </div>
      <div class="waveform ${speaking && !props.muted ? 'active' : ''}">
        ${Array.from({ length: 28 })
          .map(() => '<span class="bar"></span>')
          .join('')}
      </div>
      <div class="status-line">${subText}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" data-action="checkout" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <div class="controls">
        <button class="ctrl ${props.muted ? 'muted' : ''}" data-action="mute" aria-pressed="${props.muted}" aria-label="${props.muted ? 'Unmute' : 'Mute'}">${props.muted ? '🔇' : '🎤'}</button>
        <button class="ctrl end" data-action="end" aria-label="${STRINGS.endCallAria}">📵</button>
        <button class="ctrl" data-action="chat" aria-label="${STRINGS.chatBtnAria}">💬</button>
      </div>
    </div>
  `;
  const transcriptHost = host.querySelector('[data-region="transcript"]');
  if (transcriptHost instanceof HTMLElement) {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
  host
    .querySelector('[data-action="mute"]')
    ?.addEventListener('click', () => props.onMute(!props.muted));
  host.querySelector('[data-action="end"]')?.addEventListener('click', props.onEnd);
  host.querySelector('[data-action="chat"]')?.addEventListener('click', props.onChat);
  host.querySelector('[data-action="checkout"]')?.addEventListener('click', props.onCheckout);
}
