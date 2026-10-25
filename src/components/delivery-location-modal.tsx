"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Check, ChevronDown, X } from "lucide-react";

const MAJOR_CITIES = [
  { name: "Karachi", region: "Sindh", postal: "75500", deliveryDays: "1-2 days" },
  { name: "Lahore", region: "Punjab", postal: "54000", deliveryDays: "1-2 days" },
  { name: "Islamabad", region: "Federal", postal: "44000", deliveryDays: "2-3 days" },
  { name: "Rawalpindi", region: "Punjab", postal: "46000", deliveryDays: "2-3 days" },
  { name: "Faisalabad", region: "Punjab", postal: "38000", deliveryDays: "2-3 days" },
  { name: "Peshawar", region: "KPK", postal: "25000", deliveryDays: "3-4 days" },
  { name: "Multan", region: "Punjab", postal: "60000", deliveryDays: "2-3 days" },
  { name: "Quetta", region: "Balochistan", postal: "87300", deliveryDays: "3-5 days" },
  { name: "Sialkot", region: "Punjab", postal: "51310", deliveryDays: "2-3 days" },
  { name: "Gujranwala", region: "Punjab", postal: "52250", deliveryDays: "2-3 days" },
];

export function DeliveryLocationSelector({ tone = "light" }: { tone?: "light" | "dark" }) {
  const onDark = tone === "dark";
  const [selectedCity, setSelectedCity] = useState<string>("Karachi");
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wizz_delivery_city");
      if (saved) {
        setSelectedCity(saved);
      }
    } catch {
      // Fallback
    }
  }, []);

  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => triggerRef.current?.focus(), 50);
  };

  // Keyboard navigation & body scroll lock
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (cityName: string) => {
    setSelectedCity(cityName);
    try {
      localStorage.setItem("wizz_delivery_city", cityName);
    } catch {
      // Fallback
    }
    handleClose();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors text-left group min-h-[44px] ${onDark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"}`}
        title="Choose delivery destination"
        aria-label={`Deliver to ${selectedCity}`}
        aria-expanded={isOpen}
      >
        <MapPin size={16} className={`${onDark ? "text-emerald-300" : "text-emerald-600"} flex-shrink-0`} />
        <div className="leading-tight hidden sm:block">
          <span className={`block text-[10px] font-medium ${onDark ? "text-emerald-100/70" : "text-slate-400"}`}>Deliver to</span>
          <span className={`text-xs font-bold transition-colors flex items-center gap-0.5 ${onDark ? "text-white" : "text-slate-900 group-hover:text-emerald-600"}`}>
            {selectedCity}
            <ChevronDown size={11} className={onDark ? "text-emerald-100/70" : "text-slate-400"} />
          </span>
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="city-dialog-title"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-emerald-400" />
                <h3 id="city-dialog-title" className="text-sm font-bold">
                  Select Delivery Location
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label="Close delivery destination dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                Choose your city to see accurate delivery estimates and cash on delivery availability across Pakistan.
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {MAJOR_CITIES.map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => handleSelect(city.name)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      selectedCity === city.name
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div>
                      <span>{city.name}</span>
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {city.deliveryDays}
                      </span>
                    </div>
                    {selectedCity === city.name && (
                      <Check size={14} className="text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
