import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import { renderTranscript } from './transcript.js';
import { ICON_MIC, ICON_MIC_OFF, ICON_PHONE_OFF, ICON_MESSAGE } from './icons.js';

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
  const connected = props.voiceState !== 'idle';
  const subText = props.muted
    ? "you're muted"
    : speaking
      ? `Sage is ${STRINGS.callHeaderSpeaking}…`
      : `${STRINGS.callHeaderListening} to you…`;
  // Animate the waveform any time the call is live and not muted — both when
  // Sage speaks and when she's listening — so the visitor always has a visible
  // signal that the agent is connected and active.
  const waveformActive = connected && !props.muted;
  host.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub status-${connected ? 'connected' : 'idle'}">${connected ? STRINGS.callHeaderConnected : '…'}</div>
          </div>
        </div>
      </div>
      <div class="waveform ${waveformActive ? 'active' : ''} ${speaking ? 'speaking' : ''}">
        ${Array.from({ length: 28 })
          .map(() => '<span class="bar"></span>')
          .join('')}
      </div>
      <div class="status-line">${subText}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" data-action="checkout" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <div class="controls">
        <button class="ctrl ${props.muted ? 'muted' : ''}" data-action="mute" aria-pressed="${props.muted}" aria-label="${props.muted ? 'Unmute' : 'Mute'}">${props.muted ? ICON_MIC_OFF : ICON_MIC}</button>
        <button class="ctrl end" data-action="end" aria-label="${STRINGS.endCallAria}">${ICON_PHONE_OFF}</button>
        <button class="ctrl" data-action="chat" aria-label="${STRINGS.chatBtnAria}">${ICON_MESSAGE}</button>
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
