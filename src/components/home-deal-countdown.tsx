"use client";

import React, { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function format(msLeft: number, withSeconds: boolean) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = withSeconds ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

/**
 * Countdown chip to the soonest-ending live deal. Rendered client-side only (no hydration
 * mismatch); ticks every second, or every 30 seconds without seconds for reduced motion.
 * The ticking digits are hidden from assistive tech; the end time is given once as text.
 */
export function HomeDealCountdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, reduced ? 30_000 : 1000);
    return () => window.clearInterval(id);
  }, [reduced]);

  const ended = now !== null && now >= end;
  const endText = new Intl.DateTimeFormat("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    // Fixed zone so the server render and the browser agree
    timeZone: "Asia/Karachi",
    timeZoneName: "short",
  }).format(end);

  return (
    <span className="inline-flex items-center gap-2 h-8 rounded-full bg-ink pl-3 pr-3.5 font-mono text-[12px] text-white">
      <span className="text-[#A3A39C]">{ended ? "Deal ended" : "Ends in"}</span>
      {!ended && (
        <span aria-hidden="true" className="tabular-nums text-volt">
          {now === null ? "--:--:--" : format(end - now, !reduced)}
        </span>
      )}
      <span className="sr-only">{ended ? "" : `The soonest deal ends ${endText}.`}</span>
    </span>
  );
}
