"use client";

import React from "react";

export interface SegmentedOption {
  value: string;
  label: string;
  count?: number;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  ariaLabel,
}: SegmentedControlProps) {
  const isSm = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 bg-[#F1F3F5] rounded-lg border border-[#E3E6EB] ${className}`}
    >
      {options.map((opt) => {
        const ativo = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(opt.value)}
            className={`flex items-center justify-center gap-1.5 rounded-md font-medium transition-all ${
              isSm
                ? "px-2.5 py-1 text-xs"
                : "px-3.5 py-1.5 text-xs"
            } ${
              ativo
                ? "bg-white text-[#1A2230] font-semibold shadow-sm border border-[#E3E6EB]/80"
                : "text-[#5B6474] hover:text-[#1A2230] hover:bg-white/50"
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums ${
                  ativo
                    ? "bg-[#F1F3F5] text-[#1A2230]"
                    : "bg-[#E3E6EB] text-[#5B6474]"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
