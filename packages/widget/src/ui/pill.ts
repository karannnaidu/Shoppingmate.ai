import { STRINGS } from '../strings.js';
import { ICON_MESSAGE, ICON_MIC, ICON_MIC_OFF, ICON_PHONE, ICON_PHONE_OFF } from './icons.js';

export type TrayProps = {
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  callable: boolean;
  voiceState: 'idle' | 'connecting' | 'listening' | 'speaking' | 'muted';
  connection: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  voiceError: { code: string; message: string } | null;
  invited: boolean;
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

// The launcher has five visual phases driven by the live call lifecycle. They
// map Karan's reference screenshots (landinghero.ai) 1:1:
//   resting    → small "Talk to {P}" + AI ASSISTANT + green Call button
//   incoming   → "{P}" + INCOMING CALL (magenta) + green Accept + chat
//   connecting → "{P}" + THINKING + spinner + mic(disabled) + End
//   connected  → "{P}" + CONNECTED + waveform + mic(mute) + End
//   error      → "{P}" + TAP TO RETRY + Call(retry) + End  (panel shows why)
type CallPhase = 'resting' | 'incoming' | 'connecting' | 'connected' | 'error';

function derivePhase(props: TrayProps): CallPhase {
  if (props.voiceState === 'connecting') return 'connecting';
  if (props.voiceState !== 'idle') return 'connected';
  // voiceState === 'idle' below — no live call.
  if (props.voiceError) return 'error';
  return props.invited ? 'incoming' : 'resting';
}

// Tray rebuild key — covers everything that affects rendered output. The
// parent re-renders on every store dispatch (incl. streaming say_partial),
// so without this guard the avatar image and waveform get torn down and
// recreated on every caption chunk, producing visible flicker.
function trayKey(props: TrayProps, phase: CallPhase): string {
  return [
    phase,
    props.mode,
    props.callable ? '1' : '0',
    props.voiceState,
    props.connection,
    props.invited ? '1' : '0',
    props.personaName,
    props.personaInitial,
    props.personaAvatarUrl,
  ].join('|');
}

type PhaseChrome = {
  caption: string;
  captionClass: string;
  presenceClass: string;
  nameText: string;
  controls: string;
};

function chromeFor(props: TrayProps, phase: CallPhase): PhaseChrome {
  const muted = props.voiceState === 'muted';
  const speaking = props.voiceState === 'speaking';
  const wsOffline = props.connection === 'disconnected';

  // Compact green Call button — the ONLY thing that starts a call.
  const callBtn = (label: string, aria: string) => `
    <button class="tray-call" data-action="call" aria-label="${aria}">
      ${ICON_PHONE}<span class="tray-call-label">${label}</span>
    </button>`;
  const chatBtn = `
    <button class="tray-btn ghost" data-action="chat" aria-label="${STRINGS.openAria}">${ICON_MESSAGE}</button>`;
  const micBtn = (disabled: boolean) => `
    <button class="tray-btn ${muted ? 'muted' : ''}" data-action="mic" ${disabled ? 'disabled' : ''}
      aria-pressed="${muted}" aria-label="${muted ? STRINGS.micUnmute : STRINGS.micMute}">${muted ? ICON_MIC_OFF : ICON_MIC}</button>`;
  const endBtn = `
    <button class="tray-btn end" data-action="end" aria-label="${STRINGS.endCallAria}">${ICON_PHONE_OFF}</button>`;
  const spinner = '<span class="tray-spinner" aria-hidden="true"></span>';
  const waveform = `
    <div class="tray-waveform active ${speaking ? 'speaking' : ''}" aria-hidden="true">
      ${Array.from({ length: 14 })
        .map(() => '<span class="bar"></span>')
        .join('')}
    </div>`;

  const presence = wsOffline ? 'offline' : 'online';

  switch (phase) {
    case 'incoming':
      return {
        caption: STRINGS.captionIncoming,
        captionClass: 'incoming',
        presenceClass: presence,
        nameText: props.personaName,
        controls: `${callBtn(STRINGS.acceptCta, STRINGS.acceptAria)}${chatBtn}`,
      };
    case 'connecting':
      return {
        caption: STRINGS.captionThinking,
        captionClass: 'thinking',
        presenceClass: 'online',
        nameText: props.personaName,
        controls: `${spinner}${micBtn(true)}${endBtn}`,
      };
    case 'connected':
      return {
        caption: STRINGS.captionConnected,
        captionClass: 'connected',
        presenceClass: 'online',
        nameText: props.personaName,
        controls: `${waveform}${micBtn(false)}${endBtn}`,
      };
    case 'error':
      return {
        caption: STRINGS.captionRetry,
        captionClass: 'retry',
        presenceClass: 'offline',
        nameText: props.personaName,
        controls: `${callBtn(STRINGS.callCta, STRINGS.retryAria)}${endBtn}`,
      };
    default:
      // resting
      return {
        caption: wsOffline ? STRINGS.captionOffline : STRINGS.captionResting,
        captionClass: wsOffline ? 'retry' : 'resting',
        presenceClass: presence,
        nameText: `${STRINGS.talkToPrefix} ${props.personaName}`,
        controls: props.callable ? callBtn(STRINGS.callCta, STRINGS.callAria) : chatBtn,
      };
  }
}

export function renderPill(host: HTMLElement, props: TrayProps): void {
  const phase = derivePhase(props);
  const key = trayKey(props, phase);
  if (host.dataset.trayKey === key) return;

  const chrome = chromeFor(props, phase);
  const panelOpen = props.mode === 'chat' || props.mode === 'call' || props.mode === 'expanded';

  host.innerHTML = `
    <div class="tray phase-${phase}" role="region" aria-label="shoppingmate">
      <button class="tray-avatar" data-action="toggle" aria-expanded="${panelOpen}" aria-label="${STRINGS.openAria}">
        <span class="tray-avatar-ring" aria-hidden="true"></span>
        <img src="${props.personaAvatarUrl}" alt="" class="tray-avatar-img" draggable="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
        <span class="tray-avatar-fallback" aria-hidden="true">${props.personaInitial}</span>
        <span class="tray-presence ${chrome.presenceClass}"></span>
      </button>
      <div class="tray-meta">
        <div class="tray-name">${chrome.nameText}</div>
        <div class="tray-caption ${chrome.captionClass}">${chrome.caption}</div>
      </div>
      <div class="tray-controls">${chrome.controls}</div>
    </div>
  `;

  host.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
    if (panelOpen) props.onClose();
    else props.onChat();
  });

  // Call / Accept / Retry — the ONLY control that starts (or restarts) a call.
  host.querySelector('[data-action="call"]')?.addEventListener('click', props.onCall);

  // Chat shortcut on the incoming/resting pill.
  host.querySelector('[data-action="chat"]')?.addEventListener('click', props.onChat);

  // Mic is mute/unmute ONLY — it never starts a call. Disabled while connecting.
  host.querySelector('[data-action="mic"]')?.addEventListener('click', () => {
    props.onMute(props.voiceState !== 'muted');
  });

  host.querySelector('[data-action="end"]')?.addEventListener('click', props.onEnd);

  host.dataset.trayKey = key;
}
