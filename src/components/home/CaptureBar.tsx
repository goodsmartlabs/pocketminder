"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useQuickCapture } from "../shell/QuickCapture";
import { ButtonLink } from "../ui/primitives";
import { LogoMark } from "../shell/Navigation";

/** The always-visible "What do you need to remember?" input on Home. */
export function CaptureBar() {
  const { open } = useQuickCapture();
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        open(text);
        setText("");
      }}
      className="group relative"
    >
      <Sparkles className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-accent" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you need to remember?"
        aria-label="What do you need to remember?"
        className="h-16 w-full rounded-2xl border border-line bg-surface pl-14 pr-16 text-[17px] text-ink shadow-card placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
        maxLength={500}
      />
      <button
        type="submit"
        className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl bg-accent text-accent-ink transition-[filter] hover:brightness-110"
        aria-label="Remember this"
      >
        <ArrowRight className="size-5" />
      </button>
    </form>
  );
}

const EXAMPLES = [
  "Passport expiry",
  "Contract renewal",
  "Flight booking",
  "Certificate expiry",
  "Payment deadline",
];

export function EmptyHome({ name }: { name: string }) {
  const { open } = useQuickCapture();
  return (
    <div className="animate-fade-up mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
      <LogoMark className="size-14" />
      <p className="mt-8 text-sm text-ink-3">Welcome, {name}.</p>
      <h1 className="font-display mt-2 text-4xl font-medium tracking-tight text-ink sm:text-5xl">
        Your brain can let this one go.
      </h1>
      <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-2">
        PocketMinder remembers the dates you can&apos;t afford to forget.
      </p>
      <button
        type="button"
        onClick={() => open()}
        className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 text-[16px] font-semibold text-accent-ink shadow-[0_10px_30px_-10px_var(--accent)] transition-[filter] hover:brightness-110"
      >
        Remember Something
      </button>
      <div className="mt-12 w-full">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          For example
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => open(ex + " on ")}
              className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <ButtonLink href="/reminders/new" variant="ghost" className="mt-10">
        Or fill in the form yourself
      </ButtonLink>
    </div>
  );
}
