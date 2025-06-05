"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  children: React.ReactNode;
  tip: string;
  className?: string;
}

export function Tooltip({ children, tip, className }: TooltipProps) {
  return (
    <div className="relative inline-flex group">
      {children}
        <span 
          className={cn(
          "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-1 py-0 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-25 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none",
            className
          )}>
          {tip}
        </span>
      </div>
  );
} 