/**
 * Ornament flourish variants used across invitation sections.
 * variant: "floral" | "botanical" | "geometric"
 */
export default function Ornament({ variant = "floral", color = "#c9a961", size = 90 }) {
  const w = size;
  const h = size * 0.28;
  const view = "0 0 200 40";

  if (variant === "geometric") {
    return (
      <svg width={w} height={h} viewBox={view} fill="none" className="mx-auto opacity-80">
        <path d="M0 20 L60 20" stroke={color} strokeWidth="1" />
        <path d="M140 20 L200 20" stroke={color} strokeWidth="1" />
        <path d="M85 8 L100 20 L85 32 L100 20 L115 8 L100 20 L115 32" stroke={color} strokeWidth="1" fill="none" />
        <circle cx="100" cy="20" r="2" fill={color} />
      </svg>
    );
  }
  if (variant === "botanical") {
    return (
      <svg width={w} height={h} viewBox={view} fill="none" className="mx-auto opacity-85">
        <path d="M5 20 Q40 22 90 20" stroke={color} strokeWidth="1" fill="none" />
        <path d="M110 20 Q160 18 195 20" stroke={color} strokeWidth="1" fill="none" />
        <path d="M92 20 q4 -8 8 -8 q4 0 8 8 q-4 8 -8 8 q-4 0 -8 -8 z" fill={color} opacity="0.9" />
        <path d="M78 18 q-3 -4 -6 -3" stroke={color} strokeWidth="0.8" fill="none" />
        <path d="M78 22 q-3 4 -6 3" stroke={color} strokeWidth="0.8" fill="none" />
        <path d="M122 18 q3 -4 6 -3" stroke={color} strokeWidth="0.8" fill="none" />
        <path d="M122 22 q3 4 6 3" stroke={color} strokeWidth="0.8" fill="none" />
      </svg>
    );
  }
  // floral (default)
  return (
    <svg width={w} height={h} viewBox={view} fill="none" className="mx-auto opacity-85">
      <path d="M5 20 Q45 10 90 20" stroke={color} strokeWidth="1" fill="none" />
      <path d="M110 20 Q155 30 195 20" stroke={color} strokeWidth="1" fill="none" />
      <g transform="translate(100,20)">
        <circle r="3" fill={color} />
        <circle cx="0" cy="-6" r="2.2" fill={color} opacity="0.7" />
        <circle cx="0" cy="6" r="2.2" fill={color} opacity="0.7" />
        <circle cx="-6" cy="0" r="2.2" fill={color} opacity="0.7" />
        <circle cx="6" cy="0" r="2.2" fill={color} opacity="0.7" />
      </g>
    </svg>
  );
}
