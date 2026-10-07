import { redirect } from "next/navigation";
import { LogoMark } from "@/components/shell/Navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-accent p-12 text-accent-ink lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10 [&_rect]:fill-[var(--accent-ink)] [&_path]:stroke-[var(--accent)] [&_circle]:fill-[var(--accent)]" />
          <span className="font-display text-2xl font-semibold">PocketMinder</span>
        </div>
        <div className="my-auto max-w-lg">
          <h1 className="font-display text-5xl font-medium leading-[1.08] tracking-tight">
            Your brain for the dates you can&apos;t afford to forget.
          </h1>
          <p className="mt-6 text-lg opacity-80">
            Passports, visas, licences, contracts, insurance, renewals, deadlines. Tell PocketMinder
            once — it keeps watch and taps you on the shoulder at the right time.
          </p>
          <div className="mt-12 space-y-3">
            {[
              ["ENGINEER VISA", "14 NOV 2026", "38", "Start preparing."],
              ["AIRCRAFT INSURANCE", "03 DEC 2026", "57", "Start preparing."],
            ].map(([t, d, n, m]) => (
              <div
                key={t}
                className="flex items-center justify-between rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm"
              >
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.12em] opacity-75">{t}</p>
                  <p className="font-display text-xl">{d}</p>
                  <p className="text-sm opacity-75">{m}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-4xl leading-none">{n}</p>
                  <p className="text-[11px] font-semibold tracking-[0.12em] opacity-75">DAYS LEFT</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="font-display text-lg italic opacity-80">
          Put it in your pocket. Get it out of your head.
        </p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
