"use client";

import Image from "next/image";
import { useState } from "react";
import { OLIVIA } from "./phases";

const SIZES = {
  sm: 36,
  md: 42,
  lg: 56,
  xl: 72,
} as const;

export function OliviaAvatar({
  size = "md",
  presence,
  spin = true,
  ringFast = false,
  className = "",
}: {
  size?: keyof typeof SIZES;
  presence?: "online" | "offline";
  spin?: boolean;
  ringFast?: boolean;
  className?: string;
}) {
  const px = SIZES[size];
  const [imgOk, setImgOk] = useState(true);
  const dot = Math.max(9, Math.round(px * 0.24));

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {/* pink→purple gradient ring */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-full ${
          spin ? (ringFast ? "olivia-ring-spin--fast" : "olivia-ring-spin") : ""
        }`}
        style={{
          background:
            "conic-gradient(from 0deg, #f0abfc, #a855f7, #6366f1, #f0abfc)",
        }}
      />
      <span
        className="absolute overflow-hidden rounded-full"
        style={{ inset: 2, background: "#1a1a1a" }}
      >
        {imgOk ? (
          <Image
            src={OLIVIA.avatar}
            alt="Olivia"
            width={px}
            height={px}
            className="h-full w-full object-cover"
            onError={() => setImgOk(false)}
            unoptimized
          />
        ) : (
          <span
            className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-700 to-zinc-900 font-semibold text-white"
            style={{ fontSize: px * 0.4 }}
          >
            {OLIVIA.initial}
          </span>
        )}
      </span>
      {presence && (
        <span
          aria-hidden
          className={`absolute rounded-full ${
            presence === "online" ? "bg-emerald-500 olivia-presence-pulse" : "bg-zinc-500"
          }`}
          style={{
            width: dot,
            height: dot,
            right: 0,
            bottom: 0,
            boxShadow: "0 0 0 2px #0a0a0a",
          }}
        />
      )}
    </span>
  );
}
