import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantMap = {
  primary:
    "bg-primary text-black font-semibold hover:scale-105 active:scale-95 transition-transform",
  secondary:
    "bg-surface-2 text-white hover:bg-white/10 transition-colors",
  ghost:
    "bg-transparent border border-white/10 text-white hover:bg-surface-2 transition-colors",
  danger:
    "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 transition-colors",
};

const sizeMap = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium disabled:opacity-40 disabled:cursor-not-allowed ${variantMap[variant]} ${sizeMap[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
