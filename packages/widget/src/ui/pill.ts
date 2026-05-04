import { STRINGS } from '../strings.js';

export type PillProps = {
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  callable: boolean;
  onCall: () => void;
  onChat: () => void;
  onClose: () => void;
};

export function renderPill(host: HTMLElement, props: PillProps): void {
  const expanded = props.mode !== 'pill';
  const inCall = props.mode === 'call';
  const inChat = props.mode === 'chat';
  const labelMain = expanded
    ? 'Sage'
    : props.callable
      ? STRINGS.pillCallable
      : STRINGS.pillTextOnly;
  host.innerHTML = `
    <div class="pill" role="region" aria-label="Sage shopping assistant">
      <button class="avatar" data-action="toggle" aria-label="${expanded ? STRINGS.closeAria : STRINGS.pillCollapsed}">S</button>
      <div class="label">
        <span class="label-main">${labelMain}</span>
        <span class="label-sub">AI Assistant</span>
      </div>
      ${
        expanded
          ? `
        <div class="actions">
          ${
            props.callable
              ? `<button class="btn ${inCall ? 'btn-end' : ''}" data-action="call" aria-label="${
                  inCall ? STRINGS.endCallAria : STRINGS.callBtnAria
                }">${inCall ? STRINGS.callBtnEnd : STRINGS.callBtn}</button>`
              : ''
          }
          <button class="btn btn-icon" data-action="chat" aria-pressed="${inChat}" aria-label="${STRINGS.chatBtnAria}">💬</button>
          <button class="btn btn-icon" data-action="close" aria-label="${STRINGS.closeAria}">×</button>
        </div>
      `
          : ''
      }
    </div>
  `;
  host.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
    if (props.mode === 'pill') props.onChat();
    else props.onClose();
  });
  host.querySelector('[data-action="call"]')?.addEventListener('click', props.onCall);
  host.querySelector('[data-action="chat"]')?.addEventListener('click', props.onChat);
  host.querySelector('[data-action="close"]')?.addEventListener('click', props.onClose);
}
