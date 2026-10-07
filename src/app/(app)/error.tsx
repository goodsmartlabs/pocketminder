"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/primitives";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-display text-3xl font-medium text-ink">Something went wrong.</h1>
      <p className="mt-3 text-ink-2">
        Don&apos;t worry — your dates are safe. Try again, or head back home.
      </p>
      <div className="mt-8 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
