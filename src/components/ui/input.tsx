import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[13px] font-medium text-mute mb-1.5">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error && inputId
              ? `${inputId}-error`
              : helperText && inputId
              ? `${inputId}-helper`
              : undefined
          }
          className={`w-full rounded-xl border bg-white px-4 py-2.5 min-h-[44px] text-[15px] text-ink placeholder:text-mute-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink disabled:bg-canvas disabled:text-mute ${
            error ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500" : "border-line"
          } ${className}`}
          {...props}
        />
        {error ? (
          <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="mt-1 text-xs text-rose-600 font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={inputId ? `${inputId}-helper` : undefined} className="mt-1 text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
