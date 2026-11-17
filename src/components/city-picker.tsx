"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { ALL_PAKISTAN, CITY_COOKIE, PAKISTAN_CITIES } from "@/lib/location";

const OPTIONS: Array<{ value: string; label: string }> = [
  ...PAKISTAN_CITIES.map((c) => ({ value: c, label: c })),
  { value: ALL_PAKISTAN, label: "All of Pakistan" },
];

/** Remembers the shopper's city for a year (not sensitive; read by the server to order listings). */
function saveCityCookie(value: string) {
  document.cookie = `${CITY_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * "Showing listings near <city>" with a custom listbox (the native <select> list can't be
 * styled and looked broken on the dark strip). Keyboard: Enter/Space/ArrowDown open,
 * arrows move, Home/End jump, Enter selects, Escape closes; focus returns to the button.
 */
export function CityPicker({ city }: { city: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, OPTIONS.findIndex((o) => o.value === city)));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();

  const current = OPTIONS.find((o) => o.value === city) ?? OPTIONS[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Move focus into the list when it opens; keep the active option visible
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, OPTIONS.findIndex((o) => o.value === city)));
    setOpen(true);
  };

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const choose = (value: string) => {
    close();
    if (value === city) return;
    saveCityCookie(value);
    startTransition(() => router.refresh());
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(OPTIONS.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(OPTIONS.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(OPTIONS[active].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex items-center gap-1.5 min-w-0">
      <MapPin size={12} aria-hidden="true" className="text-volt flex-shrink-0" />
      <span id={labelId} className="whitespace-nowrap">
        {city === ALL_PAKISTAN ? "Showing listings from" : "Showing listings near"}
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${listId}-value`}
        disabled={pending}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        className="inline-flex items-center gap-1 rounded-md px-1 -mx-1 h-6 font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-volt disabled:opacity-60"
      >
        <span id={`${listId}-value`}>{current.label}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`text-white/70 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${listId}-opt-${active}`}
          onKeyDown={onListKey}
          className="absolute left-0 top-[calc(100%+8px)] z-[70] w-56 max-h-80 overflow-auto rounded-2xl border border-line bg-white p-1.5 text-ink shadow-[0_18px_40px_-12px_rgba(14,14,13,0.35)] focus:outline-none"
        >
          <li className="px-3 pt-1.5 pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-mute" role="presentation">
            Choose your city
          </li>
          {OPTIONS.map((o, i) => {
            const selected = o.value === city;
            const isActive = i === active;
            return (
              <li
                key={o.value}
                id={`${listId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 h-10 text-[14px] cursor-pointer select-none ${
                  isActive ? "bg-canvas" : ""
                } ${selected ? "font-semibold" : ""} ${o.value === ALL_PAKISTAN ? "mt-1 border-t border-line-soft rounded-t-none pt-0.5" : ""}`}
              >
                <span>{o.label}</span>
                {selected && (
                  <span className="size-5 rounded-full bg-volt flex items-center justify-center" aria-hidden="true">
                    <Check size={12} strokeWidth={2.6} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
