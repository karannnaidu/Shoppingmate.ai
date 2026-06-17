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

// Chrome key captures everything in the panel shell except the transcript
// content itself. While Sage streams a turn, only the transcript changes —
// rebuilding the whole panel each chunk would tear down card images, drop
// input focus, and cause visible flicker.
function chromeKey(props: ChatProps): string {
  const empty = props.transcript.length === 0 ? '1' : '0';
  return `${empty}|${props.checkoutUrl ?? ''}|${props.closed ? '1' : '0'}|${props.personaName}|${props.personaInitial}|${props.personaAvatarUrl}`;
}

export function renderChat(host: HTMLElement, props: ChatProps): void {
  const key = chromeKey(props);
  if (host.dataset.chromeKey !== key) {
    const empty = props.transcript.length === 0;
    // Quick-start chips: tapping one sends the matching starter prompt. They
    // look tappable (card styling), so they must actually act — previously they
    // were static <li> and visitors reported "the options don't click".
    const bullets = STRINGS.panelBullets
      .map(
        (b, i) =>
          `<button type="button" class="welcome-bullet" data-prompt="${i}" ${props.closed ? 'disabled' : ''}>${b}<span class="welcome-bullet-arrow" aria-hidden="true">→</span></button>`,
      )
      .join('');

    const welcomeHtml = empty
      ? `
        <div class="welcome">
          <div class="welcome-avatar">
            <img src="${props.personaAvatarUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
            <span class="welcome-avatar-fallback" aria-hidden="true">${props.personaInitial}</span>
          </div>
          <h2 class="welcome-heading">${STRINGS.panelHelpHeading} ${props.personaName}.</h2>
          <p class="welcome-sub">${STRINGS.panelHelpSubtitle}</p>
          <div class="welcome-bullets">${bullets}</div>
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

    host.querySelector('[data-action="close"]')?.addEventListener('click', props.onClose);
    // Welcome quick-start chips → send the matching starter prompt.
    host.querySelectorAll('.welcome-bullet').forEach((el) => {
      el.addEventListener('click', () => {
        if (props.closed) return;
        const i = Number((el as HTMLElement).dataset.prompt);
        const prompt = STRINGS.panelPrompts[i] ?? STRINGS.panelBullets[i];
        if (prompt) props.onSend(prompt);
      });
    });
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
    host.dataset.chromeKey = key;
  }

  const transcriptHost = host.querySelector('[data-region="transcript"]');
  if (transcriptHost instanceof HTMLElement) {
    renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  }
}
