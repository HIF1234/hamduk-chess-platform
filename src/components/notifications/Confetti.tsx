import { useEffect, useState } from "react";

const COLORS = ["#1a6b3a", "#f5a623", "#e53e3e", "#2b6cb0", "#f0ede8"];

/** A short CSS-only confetti burst. Renders nothing for reduced-motion users. */
export function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const [pieces] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      duration: 1.4 + Math.random() * 1.1,
      rotate: Math.random() * 720 - 360,
      drift: Math.random() * 160 - 80,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
    })),
  );
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 0 : 2800);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-12px] block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
            animation: `hamduk-confetti ${p.duration}s ${p.delay}s cubic-bezier(.2,.6,.4,1) forwards`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
