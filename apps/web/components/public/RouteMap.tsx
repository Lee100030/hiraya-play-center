'use client';

import { useId, useLayoutEffect, useRef } from 'react';

// North is up. Leave Luvers, go south to MH del Pilar, east, then north on P. Salvador to Hiraya.
const ROUTE = 'M 34 20 V 52 Q 34 62 44 62 H 112 Q 122 62 122 52 V 24';
const TRIP_MINUTES = 8;
const DRAW_MS = 1400;

const PINS = [
  { x: 34, y: 20, i: 0, label: 'Luvers', lx: 40, ly: 16, anchor: 'start' as const },
  { x: 122, y: 24, i: 1, label: 'Hiraya', lx: 116, ly: 16, anchor: 'end' as const },
];

function ease(progress: number) {
  return 1 - (1 - progress) ** 3;
}

export function RouteMap() {
  const rootRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<SVGPathElement>(null);
  const maskRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const etaRef = useRef<HTMLSpanElement>(null);
  const maskId = `route-mask-${useId().replace(/:/g, '')}`;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const guide = guideRef.current;
    const mask = maskRef.current;
    const dot = dotRef.current;
    const eta = etaRef.current;
    if (!root || !guide || !mask || !dot || !eta) return;

    let length = guide.getTotalLength();
    if (!length) {
      guide.setAttribute('stroke', 'transparent');
      guide.setAttribute('stroke-width', '1');
      length = guide.getTotalLength();
    }
    mask.style.strokeDasharray = `${length}`;

    const place = (progress: number) => {
      const point = guide.getPointAtLength(Math.max(0, Math.min(length, length * progress)));
      dot.setAttribute('cx', point.x.toFixed(2));
      dot.setAttribute('cy', point.y.toFixed(2));
      mask.style.strokeDashoffset = `${length * (1 - progress)}`;
      const minutes = Math.ceil(TRIP_MINUTES * (1 - progress));
      const label = minutes <= 0 ? 'At Hiraya' : `${minutes} min`;
      if (eta.textContent !== label) eta.textContent = label;
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      place(1);
      return;
    }

    place(0);

    let frame = 0;
    let elapsed = 0;
    let last = 0;
    let playing = false;

    const tick = (now: number) => {
      if (!playing) return;
      if (!last) last = now;
      elapsed += now - last;
      last = now;
      const progress = Math.min(1, elapsed / DRAW_MS);
      place(ease(progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else playing = false;
    };

    const play = () => {
      if (playing || elapsed >= DRAW_MS) return;
      playing = true;
      last = 0;
      root.classList.add('is-live');
      frame = window.requestAnimationFrame(tick);
    };

    const pause = () => {
      playing = false;
      last = 0;
      if (frame) window.cancelAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) play();
        else pause();
      },
      { threshold: 0.35 },
    );
    observer.observe(root);

    return () => {
      pause();
      observer.disconnect();
    };
  }, []);

  return (
    <div className="route-map" ref={rootRef}>
      <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Route from Luvers Puregold to Hiraya Kids Learning Center">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <path ref={maskRef} className="route-mask-stroke" d={ROUTE} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
        </defs>
        <path ref={guideRef} d={ROUTE} fill="none" stroke="none" />
        <rect width="160" height="100" fill="#e7f0e4" />
        <path fill="#c5dff3" d="M0 78c18-8 28-4 40 6 8 8 6 16-4 16H0V78z" />
        <path fill="#d3e8f6" d="M138 100c8-14 16-12 22-20v20H138z" />
        <rect x="52" y="32" width="28" height="14" rx="4" fill="#cfe6c6" />
        <rect x="70" y="74" width="24" height="12" rx="3.5" fill="#b7d4ae" />
        <rect x="8" y="36" width="16" height="12" rx="3.5" fill="#c5e0bc" />
        <path d="M0 28H160M0 62H160M34 0V100M78 0V100M122 0V100" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        <text className="route-street" x="78" y="59" textAnchor="middle" fontSize="2.7">
          MH del Pilar
        </text>
        <text className="route-street" x="126" y="44" textAnchor="start" fontSize="2.5">
          P. Salvador
        </text>
        <path d={ROUTE} fill="none" stroke="#1c4d34" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1.7 1.15" mask={`url(#${maskId})`} />
        {PINS.map((pin) => (
          <g key={pin.i} transform={`translate(${pin.x} ${pin.y})`}>
            <g className="route-pin" style={{ ['--i' as string]: pin.i }}>
              <path d="M0 0c-.15-.9-2.15-2.7-2.15-5.05a2.15 2.15 0 1 1 4.3 0C2.15-2.7.15-.9 0 0z" fill="#14301f" />
              <circle cy="-5.05" r="0.85" fill="#fff" />
            </g>
          </g>
        ))}
        {PINS.filter((pin) => pin.label).map((pin) => (
          <text key={pin.label} className="route-pin-label" style={{ ['--i' as string]: pin.i }} x={pin.lx} y={pin.ly} textAnchor={pin.anchor} fontSize="3.8">
            {pin.label}
          </text>
        ))}
        <circle ref={dotRef} className="route-dot" cx="34" cy="20" r="2.15" fill="#fff" stroke="#14301f" strokeWidth="0.55" />
      </svg>
      <div className="route-card">
        <div>
          <p className="route-kicker">From Luvers Puregold</p>
          <h3>To Hiraya</h3>
        </div>
        <span className="route-eta" ref={etaRef}>
          8 min
        </span>
      </div>
    </div>
  );
}
