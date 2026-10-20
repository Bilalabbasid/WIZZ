import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
}

export function Badge({ className = "", variant = "default", size = "sm", children, ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    warning: "bg-amber-50 text-amber-700 border border-amber-200/60",
    danger: "bg-rose-50 text-rose-700 border border-rose-200/60",
    info: "bg-sky-50 text-sky-700 border border-sky-200/60",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
  }[variant];

  const sizeStyles = {
    sm: "text-[11px] font-medium px-2 py-0.5 rounded-full",
    md: "text-xs font-semibold px-2.5 py-1 rounded-full",
  }[size];

  return (
    <span className={`inline-flex items-center gap-1 ${variantStyles} ${sizeStyles} ${className}`} {...props}>
      {children}
    </span>
  );
}
