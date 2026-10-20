import React from "react";
import { Star } from "lucide-react";

export function RatingStars({
  rating,
  max = 5,
  size = 16,
  showNumeric = false,
}: {
  rating: number;
  max?: number;
  size?: number;
  showNumeric?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center text-amber-400">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            size={size}
            className={`${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`}
          />
        ))}
      </div>
      {showNumeric && (
        <span className="text-xs font-semibold text-slate-700 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
