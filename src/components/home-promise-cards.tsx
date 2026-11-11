import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

/** Bottom pair: volt selling pitch and the buyer promise (only facts the platform enforces). */
export function HomePromiseCards({ returnWindowDays }: { returnWindowDays: number }) {
  return (
    <section aria-label="Selling and buying on WIZZ.PK" className="grid gap-3 md:grid-cols-2">
      <Link
        href="/sell"
        className="group flex min-h-[220px] flex-col justify-between gap-8 rounded-[28px] bg-volt p-6 text-ink md:p-8"
      >
        <span className="flex flex-col gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em]">Sell on WIZZ.PK</span>
          <span className="text-[26px] md:text-[32px] font-semibold leading-[1.02] tracking-[-0.04em]">
            Have something to sell?
            <br />
            <span className="text-ink/60">List it, we handle checkout and payments.</span>
          </span>
        </span>
        <span className="flex items-end justify-between gap-4">
          <span className="max-w-[340px] text-sm leading-relaxed text-ink/75">
            Apply as a seller, ship with your courier and get paid after delivery.
          </span>
          <span
            aria-hidden="true"
            className="flex size-12 flex-none items-center justify-center rounded-full bg-ink text-volt transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          >
            <ArrowRight size={20} />
          </span>
        </span>
      </Link>

      <div className="flex min-h-[220px] flex-col justify-between gap-6 rounded-[28px] border border-line-soft bg-white p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[26px] md:text-[32px] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
            Shop with confidence.
            <br />
            <span className="text-mute-2">Pay when it arrives.</span>
          </h2>
          <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line text-ink">
            <ShieldCheck size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-ink-2">
          <li className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 flex-none rounded-full bg-ink" aria-hidden="true" />
            Cash on delivery: pay the courier when your order arrives.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 flex-none rounded-full bg-ink" aria-hidden="true" />
            <span>
              Returns within {returnWindowDays} days of delivery.{" "}
              <Link href="/policies/returns" className="underline underline-offset-4 decoration-brand-300 hover:decoration-ink">
                Returns policy
              </Link>
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 flex-none rounded-full bg-ink" aria-hidden="true" />
            Every seller is approved by WIZZ.PK before they can list.
          </li>
        </ul>
      </div>
    </section>
  );
}
