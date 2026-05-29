import { STRINGS } from '../strings.js';
import { ICON_MIC, ICON_MIC_OFF, ICON_PHONE_OFF } from './icons.js';

export type TrayProps = {
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  callable: boolean;
  voiceState: 'idle' | 'connecting' | 'listening' | 'speaking' | 'muted';
  connection: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  personaName: string;
  personaInitial: string;
  personaAvatarUrl: string;
  onCall: () => void;
  onMute: (next: boolean) => void;
  onEnd: () => void;
  onChat: () => void;
  onClose: () => void;
};

export type PillProps = TrayProps;

// Tray rebuild key — covers everything that affects rendered output. The
// parent re-renders on every store dispatch (incl. streaming say_partial),
// so without this guard the avatar image and 18-bar waveform get torn down
// and recreated on every caption chunk, producing visible flicker.
function trayKey(props: TrayProps): string {
  return [
    props.mode,
    props.callable ? '1' : '0',
    props.voiceState,
    props.connection,
    props.personaName,
    props.personaInitial,
    props.personaAvatarUrl,
  ].join('|');
}

export function renderPill(host: HTMLElement, props: TrayProps): void {
  const key = trayKey(props);
  if (host.dataset.trayKey === key) return;

  const inCall = props.mode === 'call' || props.voiceState !== 'idle';
  const muted = props.voiceState === 'muted';
  const speaking = props.voiceState === 'speaking';
  const voiceConnecting = props.voiceState === 'connecting';
  const voiceActive = props.voiceState !== 'idle' && !voiceConnecting;
  const waveformActive = voiceActive && !muted;
  const panelOpen = props.mode === 'chat' || props.mode === 'call' || props.mode === 'expanded';

  // Pill status reflects assistant availability — the WS chat link, not the
  // voice substate. Text-only brands sit at voiceState='idle' the whole
  // session; binding the label to voiceState would scream OFFLINE at visitors
  // even though Sage is fully reachable. Voice-connecting overrides only
  // during the brief click→listening window so the visitor sees feedback.
  const wsConnecting = props.connection === 'connecting' || props.connection === 'reconnecting';
  const wsOffline = props.connection === 'disconnected';
  const showConnecting = wsConnecting || voiceConnecting;
  const statusLabel = wsOffline
    ? STRINGS.trayOffline
    : showConnecting
      ? STRINGS.trayConnecting
      : STRINGS.trayConnected;
  const statusClass = wsOffline
    ? 'tray-status idle'
    : showConnecting
      ? 'tray-status connecting'
      : 'tray-status connected';
  const presenceClass = wsOffline ? 'idle' : showConnecting ? 'connecting' : 'connected';

  const waveformHtml = `
    <div class="tray-waveform ${waveformActive ? 'active' : ''} ${speaking ? 'speaking' : ''}" aria-hidden="true">
      ${Array.from({ length: 18 })
        .map(() => '<span class="bar"></span>')
        .join('')}
    </div>
  `;

  const micAriaLabel = !props.callable
    ? STRINGS.micStart
    : !inCall
      ? STRINGS.micStart
      : muted
        ? STRINGS.micUnmute
        : STRINGS.micMute;

  const micIcon = muted ? ICON_MIC_OFF : ICON_MIC;
  const endHidden = !inCall;

  host.innerHTML = `
    <div class="tray" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${panelOpen}" aria-label="${STRINGS.openAria}">
        <img src="${props.personaAvatarUrl}" alt="" class="tray-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${props.personaInitial}</span>
        <span class="tray-presence ${presenceClass}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${props.personaName}</div>
        <div class="${statusClass}"><span class="tray-status-dot"></span>${statusLabel}</div>
      </div>
      ${waveformHtml}
      <div class="tray-controls">
        <button class="tray-btn ${muted ? 'muted' : ''}" data-action="mic" aria-pressed="${muted}" aria-label="${micAriaLabel}">${micIcon}</button>
        <button class="tray-btn end ${endHidden ? 'hidden' : ''}" data-action="end" aria-label="${STRINGS.endCallAria}">${ICON_PHONE_OFF}</button>
      </div>
    </div>
  `;

  host.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
    if (panelOpen) props.onClose();
    else props.onChat();
  });

  host.querySelector('[data-action="mic"]')?.addEventListener('click', () => {
    if (!inCall) {
      props.onCall();
    } else {
      props.onMute(!muted);
    }
  });

  host.querySelector('[data-action="end"]')?.addEventListener('click', props.onEnd);

  host.dataset.trayKey = key;
}
