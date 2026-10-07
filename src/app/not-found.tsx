import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Not found</p>
      <h1 className="font-display mt-2 text-3xl font-medium text-ink">
        We couldn&apos;t find that one.
      </h1>
      <p className="mt-3 max-w-sm text-ink-2">
        It may have been deleted, or the link is wrong. Everything else is right where you left it.
      </p>
      <ButtonLink href="/" className="mt-8">
        Back to PocketMinder
      </ButtonLink>
    </div>
  );
}
