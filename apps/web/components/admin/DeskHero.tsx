'use client';

import { useEffect, useRef } from 'react';

function compactPeso(value: number) {
  if (value >= 1000) return `₱${Math.round(value / 1000)}k`;
  return `₱${Math.round(value).toLocaleString()}`;
}

export function DeskHero({
  kicker,
  title,
  description,
  students,
  pending,
  paid,
}: {
  kicker?: string;
  title: string;
  description?: string;
  students: number;
  pending: number;
  paid: number;
}) {
  const stageRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const tilt = tiltRef.current;
    if (!stage || !tilt) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (event: PointerEvent) => {
      const box = stage.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      tilt.style.transform = `translate(${(x * 12).toFixed(2)}px, ${(y * 8).toFixed(2)}px)`;
    };
    const onLeave = () => {
      tilt.style.transform = 'translate(0px, 0px)';
    };

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <section className="desk-hero" ref={stageRef} aria-labelledby="desk-hero-title">
      <div className="desk-hero-copy">
        <p className="admin-page-crumb">{`HIRAYA / ${title}`}</p>
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h1 id="desk-hero-title">{title}</h1>
        {description ? <p className="admin-page-lead">{description}</p> : null}
      </div>
      <div className="mock-stage">
        <div className="mock-shadow" aria-hidden="true" />
        <div className="mock-parallax" ref={tiltRef}>
          <div className="mock-float">
            <div className="mock-frame">
              <div className="mock-titlebar">
                <span className="mock-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>HIRAYA Desktop</strong>
              </div>
              <div className="mock-body">
                <aside className="mock-side" aria-hidden="true">
                  <span className="is-on">Dashboard</span>
                  <span>Students</span>
                  <span>Calendar</span>
                  <span>Finance</span>
                </aside>
                <div className="mock-main" aria-hidden="true">
                  <p>Center desk</p>
                  <div className="mock-stats">
                    <article>
                      <small>Students</small>
                      <b>{students}</b>
                    </article>
                    <article>
                      <small>Pending</small>
                      <b>{pending}</b>
                    </article>
                    <article>
                      <small>Paid</small>
                      <b>{compactPeso(paid)}</b>
                    </article>
                  </div>
                  <div className="mock-bars">
                    <span style={{ width: '78%' }} />
                    <span style={{ width: '54%' }} />
                    <span style={{ width: '66%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
