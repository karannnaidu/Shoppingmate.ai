import { STRINGS } from '../strings.js';
import type { TranscriptItem } from '../state/store.js';
import { renderTranscript } from './transcript.js';

export type ChatProps = {
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  onSend: (text: string) => void;
  onCall: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  closed: boolean;
};

export function renderChat(host: HTMLElement, props: ChatProps): void {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">${STRINGS.chatHeaderSubtitle}</div>
          </div>
        </div>
        <button class="btn" data-action="call" aria-label="${STRINGS.callBtnAria}">${STRINGS.callBtn}</button>
      </div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <form class="input-row">
        <input type="text" placeholder="${STRINGS.chatPlaceholder}" ${props.closed ? 'disabled' : ''} />
        <button class="send" type="submit" aria-label="Send" ${props.closed ? 'disabled' : ''}>↵</button>
      </form>
    </div>
  `;
  const transcriptHost = host.querySelector('[data-region="transcript"]');
  if (transcriptHost instanceof HTMLElement) {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
  host.querySelector('[data-action="call"]')?.addEventListener('click', props.onCall);
  const form = host.querySelector('form');
  const input = host.querySelector('input');
  if (form instanceof HTMLFormElement && input instanceof HTMLInputElement) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      props.onSend(text);
    });
  }
}
