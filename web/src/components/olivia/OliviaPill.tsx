"use client";

import { Mic, MicOff, Phone, PhoneOff, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OliviaAvatar } from "./OliviaAvatar";
import { OliviaWaveform } from "./OliviaWaveform";
import { type OliviaPhase, chromeForPhase } from "./phases";

const GreenCall = ({
  label,
  pulse,
  onClick,
}: {
  label: string;
  pulse?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label} Olivia`}
    className={`inline-flex h-[34px] items-center gap-1.5 rounded-full bg-emerald-600 pl-3 pr-3.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(22,163,74,0.8)] transition-transform hover:scale-[1.03] hover:bg-emerald-500 active:scale-95 ${
      pulse ? "olivia-call-pulse" : ""
    }`}
  >
    <Phone className="h-[15px] w-[15px]" />
    {label}
  </button>
);

const RoundBtn = ({
  children,
  variant = "ghost",
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  variant?: "ghost" | "muted" | "end";
  disabled?: boolean;
  onClick?: () => void;
  label: string;
}) => {
  const styles =
    variant === "end"
      ? "bg-red-500 text-white hover:bg-red-600 border-transparent"
      : variant === "muted"
        ? "bg-rose-500/15 text-rose-300 border-rose-400/40"
        : "bg-white/[0.06] text-white border-white/10 hover:bg-white/[0.12]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-full border transition-transform active:scale-95 disabled:opacity-45 ${styles}`}
    >
      {children}
    </button>
  );
};

export function OliviaPill({
  phase: fixedPhase,
  interactive = false,
  start = "resting",
  className = "",
}: {
  /** Render a single fixed phase (for the states gallery). */
  phase?: OliviaPhase;
  /** Drive its own resting→connecting→connected lifecycle on click. */
  interactive?: boolean;
  start?: OliviaPhase;
  className?: string;
}) {
  const [phase, setPhase] = useState<OliviaPhase>(fixedPhase ?? start);
  const [muted, setMuted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fixedPhase) setPhase(fixedPhase);
  }, [fixedPhase]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const startCall = useCallback(() => {
    setMuted(false);
    setPhase("connecting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("connected"), 1700);
  }, []);

  const endCall = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPhase("resting");
    setMuted(false);
  }, []);

  const chrome = chromeForPhase(phase);
  const ringFast = phase === "incoming";

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-full border bg-[#0a0a0a] py-1.5 pl-1.5 pr-2 text-white shadow-[0_24px_48px_-16px_rgba(0,0,0,0.65)] transition-[border-color,box-shadow] duration-300 ${
        phase === "incoming"
          ? "border-fuchsia-400/45 shadow-[0_0_0_1px_rgba(232,121,249,0.25),0_0_28px_-4px_rgba(232,121,249,0.5)]"
          : "border-white/10"
      } ${className}`}
      role="group"
      aria-label="Olivia launcher preview"
    >
      <OliviaAvatar size="md" presence={chrome.presence} ringFast={ringFast} />

      <div className="min-w-0 leading-tight">
        <div className="whitespace-nowrap text-[13px] font-semibold tracking-tight">
          {chrome.name}
        </div>
        <div
          className={`mt-0.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.18em] ${chrome.captionClass} ${
            chrome.captionBlink ? "olivia-caption-blink" : ""
          }`}
        >
          {chrome.caption}
        </div>
      </div>

      <div className="ml-1 flex items-center gap-1.5">
        {phase === "resting" && (
          <GreenCall label="Call" onClick={interactive ? startCall : undefined} />
        )}

        {phase === "incoming" && (
          <>
            <GreenCall label="Accept" pulse onClick={interactive ? startCall : undefined} />
            <RoundBtn label="Open chat" onClick={interactive ? endCall : undefined}>
              <MessageCircle className="h-[14px] w-[14px]" />
            </RoundBtn>
          </>
        )}

        {phase === "connecting" && (
          <>
            <span
              aria-hidden
              className="olivia-spin h-[18px] w-[18px] rounded-full border-2 border-white/20 border-t-emerald-400"
            />
            <RoundBtn label="Mute" disabled>
              <Mic className="h-[14px] w-[14px]" />
            </RoundBtn>
            <RoundBtn label="End call" variant="end" onClick={interactive ? endCall : undefined}>
              <PhoneOff className="h-[14px] w-[14px]" />
            </RoundBtn>
          </>
        )}

        {phase === "connected" && (
          <>
            <OliviaWaveform active={!muted} className="px-1" />
            <RoundBtn
              label={muted ? "Unmute" : "Mute"}
              variant={muted ? "muted" : "ghost"}
              onClick={interactive ? () => setMuted((m) => !m) : undefined}
            >
              {muted ? <MicOff className="h-[14px] w-[14px]" /> : <Mic className="h-[14px] w-[14px]" />}
            </RoundBtn>
            <RoundBtn label="End call" variant="end" onClick={interactive ? endCall : undefined}>
              <PhoneOff className="h-[14px] w-[14px]" />
            </RoundBtn>
          </>
        )}

        {phase === "error" && (
          <>
            <GreenCall label="Call" onClick={interactive ? startCall : undefined} />
            <RoundBtn label="End call" variant="end" onClick={interactive ? endCall : undefined}>
              <PhoneOff className="h-[14px] w-[14px]" />
            </RoundBtn>
          </>
        )}
      </div>
    </div>
  );
}
