"use client";

import { SectionHead, SerifEm } from "./v2/primitives";
import { OliviaCallStates } from "./olivia/OliviaCallStates";

export function OliviaStates() {
  return (
    <section id="states" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="What shoppers see"
          title={
            <>
              Every moment of the call, <SerifEm>designed.</SerifEm>
            </>
          }
          subtitle="From a quiet button in the corner to a live conversation — exactly what your shoppers see. One tap starts the call; the mic button only mutes."
        />
        <div className="mt-14">
          <OliviaCallStates />
        </div>
      </div>
    </section>
  );
}
