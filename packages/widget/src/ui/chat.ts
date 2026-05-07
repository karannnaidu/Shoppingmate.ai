import type { TranscriptItem } from '../state/store.js';
import { STRINGS } from '../strings.js';
import { ICON_SEND, ICON_X } from './icons.js';
import { renderTranscript } from './transcript.js';

export type ChatProps = {
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  personaName: string;
  personaInitial: string;
  personaAvatarUrl: string;
  onSend: (text: string) => void;
  onCall: () => void;
  onClose: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  closed: boolean;
};

export function renderChat(host: HTMLElement, props: ChatProps): void {
  const empty = props.transcript.length === 0;
  const bullets = STRINGS.panelBullets.map((b) => `<li>${b}</li>`).join('');

  const welcomeHtml = empty
    ? `
      <div class="welcome">
        <div class="welcome-avatar">
          <img src="${props.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
          <span class="welcome-avatar-fallback" aria-hidden="true">${props.personaInitial}</span>
        </div>
        <h2 class="welcome-heading">${STRINGS.panelHelpHeading} ${props.personaName}.</h2>
        <p class="welcome-sub">${STRINGS.panelHelpSubtitle}</p>
        <ul class="welcome-bullets">${bullets}</ul>
      </div>
    `
    : '';

  host.innerHTML = `
    <div class="panel">
      <button class="panel-close" data-action="close" aria-label="${STRINGS.closeAria}">${ICON_X}</button>
      ${welcomeHtml}
      <div class="transcript ${empty ? 'transcript-empty' : ''}" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <form class="input-row">
        <input type="text" placeholder="${STRINGS.chatPlaceholder}" ${props.closed ? 'disabled' : ''} />
        <button class="send" type="submit" aria-label="Send" ${props.closed ? 'disabled' : ''}>${ICON_SEND}</button>
      </form>
      <div class="panel-footer">${STRINGS.poweredBy}</div>
    </div>
  `;

  const transcriptHost = host.querySelector('[data-region="transcript"]');
  if (transcriptHost instanceof HTMLElement) {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
  host.querySelector('[data-action="close"]')?.addEventListener('click', props.onClose);
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
