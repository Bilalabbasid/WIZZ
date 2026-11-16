"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { ALL_PAKISTAN, CITY_COOKIE, PAKISTAN_CITIES } from "@/lib/location";

/** "Showing listings near <city>" with a city picker; nearby sellers' listings are shown first. */
export function CityPicker({ city }: { city: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

  const choose = (value: string) => {
    document.cookie = `${CITY_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <MapPin size={12} aria-hidden="true" className="text-volt flex-shrink-0" />
      <label htmlFor={id} className="whitespace-nowrap">
        {city === ALL_PAKISTAN ? "Showing listings from" : "Showing listings near"}
      </label>
      <span className="relative inline-flex items-center">
        <select
          id={id}
          value={city}
          disabled={pending}
          onChange={(e) => choose(e.target.value)}
          className="appearance-none bg-transparent font-semibold text-white pr-4 cursor-pointer [field-sizing:content] focus:outline-none focus-visible:underline disabled:opacity-60"
        >
          {PAKISTAN_CITIES.map((c) => (
            <option key={c} value={c} className="text-ink">
              {c}
            </option>
          ))}
          <option value={ALL_PAKISTAN} className="text-ink">
            all of Pakistan
          </option>
        </select>
        <ChevronDown size={11} aria-hidden="true" className="absolute right-0 pointer-events-none text-white/70" />
      </span>
    </div>
  );
}
