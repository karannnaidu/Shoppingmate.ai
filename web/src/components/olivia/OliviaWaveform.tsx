"use client";

// Compact equaliser that mirrors the widget's in-call waveform. When `active`
// the bars dance; `speaking` flips them white (Olivia talking) vs emerald
// (Olivia listening).
const PEAKS = [0.4, 0.7, 0.5, 0.85, 0.6, 0.75, 0.45, 0.9, 0.55, 0.8, 0.48, 0.92, 0.62, 0.72];
const DELAYS = [0, 60, 30, 90, 50, 110, 20, 130, 70, 100, 40, 150, 80, 120];

export function OliviaWaveform({
  active = true,
  speaking = false,
  className = "",
}: {
  active?: boolean;
  speaking?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex h-6 items-center gap-[2px] ${className}`}
    >
      {PEAKS.map((peak, i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full ${active ? "olivia-bar" : ""} ${
            speaking ? "bg-white" : "bg-emerald-400"
          }`}
          style={{
            height: active ? `${Math.round(peak * 100)}%` : "22%",
            animationDelay: `${DELAYS[i]}ms`,
            opacity: active ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
