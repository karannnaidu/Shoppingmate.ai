"use client";

import { SectionHead } from "./HowItWorks";
import { OliviaCallStates } from "./olivia/OliviaCallStates";

export function OliviaStates() {
  return (
    <section
      id="states"
      className="relative border-y border-border bg-surface-muted/40 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="The call, end to end"
          title="Every moment of the call, designed."
          subtitle="From a quiet launcher to a live conversation — here is exactly what your visitors see. The Call button starts the call; the mic only mutes."
        />
        <div className="mt-14">
          <OliviaCallStates />
        </div>
      </div>
    </section>
  );
}
