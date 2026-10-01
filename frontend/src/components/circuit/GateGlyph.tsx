"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { formatAngle, getGate } from "@/lib/gates";
import type { GateParams, GateType } from "@/types";

/** Measurement dial — the standard "meter" glyph for a measure operation. */
export function MeterIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M4 17a8 8 0 0 1 16 0" />
      <path d="M12 17l4.5-6" />
    </svg>
  );
}

interface GateGlyphProps {
  type: GateType;
  params?: GateParams;
  /** Rendered size in px (square). */
  size?: number;
  /** Override height (used by two-qubit "box" gates that span rows). */
  height?: number;
  selected?: boolean;
  className?: string;
  showParam?: boolean;
}

/**
 * The visual body of a gate. Pure presentation — the same glyph is used in
 * the library, on the canvas and in the inspector so they always match.
 */
function GateGlyph({
  type,
  params,
  size = 44,
  height,
  selected = false,
  className,
  showParam = true,
}: GateGlyphProps) {
  const def = getGate(type);
  const solid = def.variant === "solid";
  const firstParam = def.params[0];
  const paramText =
    showParam && firstParam
      ? def.params.length > 1
        ? def.params.map((p) => p.label).join(",")
        : formatAngle(params?.[firstParam.key] ?? firstParam.default)
      : null;
  const long = def.symbol.length > 2;

  return (
    <div
      className={cn(
        "relative flex select-none flex-col items-center justify-center rounded-lg font-semibold leading-none transition-[box-shadow,transform] duration-150",
        solid ? "text-[color:var(--gate-label)]" : "bg-elevated text-foreground",
        selected && "ring-2 ring-cyber-cyan ring-offset-2 ring-offset-background",
        className
      )}
      style={{
        width: size,
        height: height ?? size,
        background: solid
          ? `linear-gradient(180deg, color-mix(in srgb, ${def.color} 100%, white 8%), ${def.color})`
          : undefined,
        border: solid ? "1px solid rgb(255 255 255 / 0.12)" : `1.5px solid ${def.color}`,
        boxShadow: solid
          ? `0 1px 0 rgb(255 255 255 / 0.15) inset, 0 4px 12px -6px ${def.color}`
          : `0 0 0 1px rgb(0 0 0 / 0.02), 0 4px 12px -8px ${def.color}`,
      }}
    >
      {type === "M" ? (
        <MeterIcon size={Math.round(size * 0.5)} className="text-[color:var(--gate-meas)]" />
      ) : (
        <span style={{ fontSize: long ? size * 0.27 : size * 0.36 }}>{def.symbol}</span>
      )}
      {paramText && (
        <span
          className={cn(
            "mt-0.5 font-mono font-medium",
            solid ? "text-[color:var(--gate-label)] opacity-80" : "text-muted-foreground"
          )}
          style={{ fontSize: Math.max(8, size * 0.2) }}
        >
          {paramText}
        </span>
      )}
    </div>
  );
}

export default memo(GateGlyph);
