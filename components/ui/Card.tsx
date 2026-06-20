import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  className = "",
  padding = "md",
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-surface-1 border border-white/5 rounded-3xl ${paddingMap[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
