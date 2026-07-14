"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface-white neo-border rounded-[24px] neo-shadow-md p-6 md:p-8 neo-button-transition",
          interactive && "hover:-translate-x-[4px] hover:-translate-y-[4px] hover:shadow-flat-hover cursor-pointer active:translate-x-0 active:translate-y-0 active:shadow-flat-md",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
