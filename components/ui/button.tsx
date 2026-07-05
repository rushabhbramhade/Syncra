"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "accent-purple" | "accent-pink";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center font-bold text-center neo-border rounded-[18px] neo-button-transition select-none outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:pointer-events-none cursor-pointer min-h-[44px]",
          
          // Variants
          variant === "primary" && "bg-primary text-white hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-flat-hover shadow-flat-md active:-translate-x-0 active:-translate-y-0",
          variant === "secondary" && "bg-surface-white text-secondary hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-flat-hover shadow-flat-sm active:-translate-x-0 active:-translate-y-0",
          variant === "destructive" && "bg-error text-white hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-flat-hover shadow-flat-md active:-translate-x-0 active:-translate-y-0 border-[#7F1D1D]",
          variant === "accent-purple" && "bg-accent-purple text-white hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-flat-hover shadow-flat-md active:-translate-x-0 active:-translate-y-0",
          variant === "accent-pink" && "bg-accent-pink text-white hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-flat-hover shadow-flat-md active:-translate-x-0 active:-translate-y-0",
          variant === "ghost" && "border-transparent bg-transparent shadow-none hover:bg-black/5 active:bg-black/10 min-h-0",

          // Sizes
          size === "sm" && "text-[15px] px-5 py-2",
          size === "md" && "text-[18px] px-7 py-3.5",
          size === "lg" && "text-[20px] px-9 py-4.5",

          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
