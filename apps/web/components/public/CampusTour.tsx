'use client';

import { CAMPUS_PHOTOS } from '@/lib/campus';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function CampusTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const slides = CAMPUS_PHOTOS;
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setIndex((value) => (value + slides.length - 1) % slides.length);
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % slides.length);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, slides.length]);

  if (!mounted) return null;

  return createPortal(
    <div className="enroll-overlay tour-overlay" role="presentation" onClick={onClose}>
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
        <div className="tour-frame">
          <Image src={slide.src} alt={slide.title} fill sizes="100vw" className="tour-photo" priority />
          <div className="tour-veil" aria-hidden="true" />
          <div className="tour-caption">
            <p className="eyebrow">
              Campus · {index + 1} / {slides.length}
            </p>
            <h2 id="tour-title">{slide.title}</h2>
            <p>{slide.copy}</p>
          </div>
          <button
            type="button"
            className="tour-arrow tour-prev"
            aria-label="Previous space"
            onClick={() => setIndex((value) => (value + slides.length - 1) % slides.length)}
          >
            ‹
          </button>
          <button
            type="button"
            className="tour-arrow tour-next"
            aria-label="Next space"
            onClick={() => setIndex((value) => (value + 1) % slides.length)}
          >
            ›
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
