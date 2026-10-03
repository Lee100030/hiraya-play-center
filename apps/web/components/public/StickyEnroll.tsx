'use client';

import { EnrollTrigger } from '@/components/public/enrollment';
import { useEffect, useState } from 'react';

function dockHeight() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--float-dock-height');
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 96;
}

export function StickyEnroll() {
  const [show, setShow] = useState(false);
  const [parked, setParked] = useState(false);

  useEffect(() => {
    const measure = () => {
      const vh = window.innerHeight;
      const dock = dockHeight();
      let hit = false;
      document.querySelectorAll<HTMLElement>('[data-float-clear]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > vh - dock && r.top < vh) hit = true;
      });
      const copy = document.querySelector<HTMLElement>('.footer-copy');
      const copyVisible = Boolean(copy && copy.getBoundingClientRect().top < vh - 8);
      setParked(hit);
      setShow(window.scrollY > 520 && !copyVisible);
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  if (!show) return null;

  return (
    <EnrollTrigger
      className={parked ? 'float-enroll float-enroll--parked' : 'float-enroll'}
      magnetic={false}
    >
      Enroll
    </EnrollTrigger>
  );
}
