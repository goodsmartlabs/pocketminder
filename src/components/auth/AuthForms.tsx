"use client";

import Link from "next/link";
import { useState } from "react";
import { useClientValue } from "@/lib/useClientValue";
import { LogoMark } from "../shell/Navigation";
import { Button, Field, Input } from "../ui/primitives";

/*
 * Sign-in and sign-up are plain HTML forms posting to /api/auth/*. The server
 * sets the session cookie and answers with a 303 redirect, so they work with
 * or without JavaScript and behind any hosting proxy.
 */

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <LogoMark className="size-11 lg:hidden" />
      <h1 className="font-display mt-6 text-3xl font-medium tracking-tight text-ink lg:mt-0">
        {title}
      </h1>
      <p className="mt-2 text-ink-2">{subtitle}</p>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-critical-bg px-4 py-3 text-sm text-critical" role="alert">
      {children}
    </div>
  );
}

export function LoginForm({ error, email }: { error: string | null; email?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <>
      <Heading title="Welcome back." subtitle="Let's see what you need to remember." />
      <form
        method="post"
        action="/api/auth/login"
        className="space-y-5"
        onSubmit={() => setPending(true)}
      >
        {error && (
          <ErrorBox>
            <p>{error}</p>
            <p className="mt-1.5 text-ink-2">
              No account on this site yet?{" "}
              <Link
                href={`/signup${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                className="font-semibold text-accent underline"
              >
                Create one with this email
              </Link>
            </p>
          </ErrorBox>
        )}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={email}
            required
            autoFocus
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-ink-2">
        New to PocketMinder?{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function SignupForm({
  error,
  email,
  name,
}: {
  error: string | null;
  email?: string;
  name?: string;
}) {
  const [pending, setPending] = useState(false);
  const timezone = useClientValue(browserTimeZone, "UTC");
  return (
    <>
      <Heading
        title="Get it out of your head."
        subtitle="Create your PocketMinder. It takes ten seconds."
      />
      <form
        method="post"
        action="/api/auth/signup"
        className="space-y-5"
        onSubmit={() => setPending(true)}
      >
        {error && (
          <ErrorBox>
            <p>{error}</p>
          </ErrorBox>
        )}
        <input type="hidden" name="timezone" value={timezone} />
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" defaultValue={name} required autoFocus />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={email}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Create my PocketMinder
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
