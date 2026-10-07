"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction, type AuthFormState } from "@/app/actions/auth";
import { useClientValue } from "@/lib/useClientValue";
import { LogoMark } from "../shell/Navigation";
import { Button, Field, Input } from "../ui/primitives";

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

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  return (
    <>
      <Heading title="Welcome back." subtitle="Let's see what you need to remember." />
      <form action={action} className="space-y-5" noValidate>
        {state.error && (
          <p className="rounded-xl bg-critical-bg px-4 py-3 text-sm text-critical" role="alert">
            {state.error}
          </p>
        )}
        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email}
            invalid={!!state.fieldErrors?.email}
            required
            autoFocus
          />
        </Field>
        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            invalid={!!state.fieldErrors?.password}
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

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signupAction, {});
  const timezone = useClientValue(browserTimeZone, "UTC");
  return (
    <>
      <Heading
        title="Get it out of your head."
        subtitle="Create your PocketMinder. It takes ten seconds."
      />
      <form action={action} className="space-y-5" noValidate>
        {state.error && (
          <p className="rounded-xl bg-critical-bg px-4 py-3 text-sm text-critical" role="alert">
            {state.error}
          </p>
        )}
        <input type="hidden" name="timezone" value={timezone} />
        <Field label="Your name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name}
            invalid={!!state.fieldErrors?.name}
            required
            autoFocus
          />
        </Field>
        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email}
            invalid={!!state.fieldErrors?.email}
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={state.fieldErrors?.password}
          hint="At least 8 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            invalid={!!state.fieldErrors?.password}
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
