"use client";

type PctRingProps = {
  pct: number | null;
  color: string;
  label: string;
};

export function PctRing({ pct, color, label }: PctRingProps) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = pct == null ? 0 : Math.min(100, Math.max(0, pct)) / 100;
  const offset = c * (1 - fill);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-xs font-semibold tabular-nums text-ink">
        {label}
      </span>
    </div>
  );
}
