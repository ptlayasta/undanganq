import { useEffect, useState } from "react";

export default function Countdown({ targetDate, accent = "#c9a961", textColor = "#1a1a1a" }) {
  const [t, setT] = useState(diff(targetDate));

  useEffect(() => {
    const i = setInterval(() => setT(diff(targetDate)), 1000);
    return () => clearInterval(i);
  }, [targetDate]);

  const cells = [
    { label: "Hari", value: t.d },
    { label: "Jam", value: t.h },
    { label: "Menit", value: t.m },
    { label: "Detik", value: t.s },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 max-w-md mx-auto" data-testid="countdown">
      {cells.map((c) => (
        <div key={c.label} className="text-center py-4 rounded-lg" style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${accent}33` }}>
          <div className="text-3xl font-bold tabular-nums" style={{ color: textColor }}>{String(c.value).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: accent }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function diff(target) {
  if (!target) return { d: 0, h: 0, m: 0, s: 0 };
  const now = Date.now();
  const then = new Date(target).getTime();
  const ms = Math.max(0, then - now);
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
  };
}
