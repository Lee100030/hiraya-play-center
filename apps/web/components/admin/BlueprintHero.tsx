'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const VERTICALS = [18, 40, 62, 84];
const HORIZONTALS = [22, 50, 78];

export function BlueprintHero({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={heroRef} className={drawn ? 'bp-hero is-drawn' : 'bp-hero'}>
      <div className="bp-grid" aria-hidden="true">
        {VERTICALS.map((left, index) => (
          <span key={`v${left}`} className="bp-line bp-v" style={{ left: `${left}%`, '--i': index } as CSSProperties} />
        ))}
        {HORIZONTALS.map((top, index) => (
          <span key={`h${top}`} className="bp-line bp-h" style={{ top: `${top}%`, '--i': index + VERTICALS.length } as CSSProperties} />
        ))}
        <span className="bp-line bp-v bp-inset" style={{ left: 10, '--i': 7 } as CSSProperties} />
        <span className="bp-line bp-v bp-inset" style={{ right: 10, '--i': 8 } as CSSProperties} />
        <span className="bp-line bp-h bp-inset" style={{ top: 10, '--i': 9 } as CSSProperties} />
        <span className="bp-line bp-h bp-inset" style={{ bottom: 10, '--i': 10 } as CSSProperties} />
        {VERTICALS.flatMap((left, column) =>
          HORIZONTALS.map((top, row) => (
            <span
              key={`m${left}-${top}`}
              className="bp-mark"
              style={{ left: `${left}%`, top: `${top}%`, '--m': row * VERTICALS.length + column } as CSSProperties}
            />
          )),
        )}
        <span className="bp-spec bp-spec-tl">HKLC · CAL-01</span>
        <span className="bp-spec bp-spec-tr">Sheet A</span>
        <span className="bp-spec bp-spec-bl">Scale 1:1</span>
        <span className="bp-spec bp-spec-br">Center</span>
      </div>
      <div className="bp-sheet">
        <div className="bp-sheet-copy">
          {kicker ? <p className="bp-kicker">{kicker}</p> : null}
          <h1>{title}</h1>
          {description ? <p className="bp-lead">{description}</p> : null}
        </div>
        {actions ? <div className="bp-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
