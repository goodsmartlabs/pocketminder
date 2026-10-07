import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-4 inline-flex items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-ink-3 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-medium leading-tight tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-[15px] text-ink-2">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
