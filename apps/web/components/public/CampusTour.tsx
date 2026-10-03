'use client';

import { CAMPUS_PHOTOS } from '@/lib/campus';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export function CampusTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slides = CAMPUS_PHOTOS;
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="enroll-overlay" role="presentation" onClick={onClose}>
      <div
        className="tour-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="enroll-modal-close" onClick={onClose} aria-label="Close campus tour">
          ×
        </button>
        <p className="eyebrow">Campus</p>
        <h2 id="tour-title">Walk through HIRAYA Play Center</h2>
        <div className="tour-frame">
          <Image src={slide.src} alt={slide.title} fill sizes="(max-width: 840px) 100vw, 820px" className="tour-photo" />
          <div className="tour-veil" aria-hidden="true" />
        </div>
        <h3>{slide.title}</h3>
        <p>{slide.copy}</p>
        <div className="tour-nav">
          <button type="button" className="btn-ghost" onClick={() => setIndex((value) => (value + slides.length - 1) % slides.length)}>
            Previous
          </button>
          <span>
            {index + 1} / {slides.length}
          </span>
          <button type="button" className="btn-hero" onClick={() => setIndex((value) => (value + 1) % slides.length)}>
            Next space
          </button>
        </div>
      </div>
    </div>
  );
}
