'use client';

import { CAMPUS_PHOTOS } from '@/lib/campus';
import Image from 'next/image';
import { useEffect, useRef, useState, type AnimationEvent } from 'react';
import { createPortal } from 'react-dom';

type Phase = 'approach' | 'zooming' | 'through' | 'arrived';

export function CampusTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('approach');
  const firstRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLButtonElement>(null);
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    if (reduced) {
      setPhase('through');
      timer = window.setTimeout(() => setPhase('arrived'), 380);
    }
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [onClose, slides.length]);

  useEffect(() => {
    if (!mounted || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    windowRef.current?.focus();
  }, [mounted]);

  function enterCampus() {
    const scene = firstRef.current;
    const frame = windowRef.current;
    if (!scene || !frame || phase !== 'approach') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('through');
      window.setTimeout(() => setPhase('arrived'), 380);
      return;
    }
    const sceneBox = scene.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    if (frameBox.width < 1) return;
    const originX = frameBox.left + frameBox.width / 2 - sceneBox.left;
    const originY = frameBox.top + frameBox.height / 2 - sceneBox.top;
    scene.style.transformOrigin = `${originX}px ${originY}px`;
    scene.style.setProperty('--zoom-scale', String(window.innerWidth / frameBox.width));
    scene.style.willChange = 'transform';
    setPhase('zooming');
  }

  function onZoomEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== 'zoom-through' || event.target !== firstRef.current) return;
    const scene = firstRef.current;
    if (!scene) return;
    scene.style.transform = `scale(${scene.style.getPropertyValue('--zoom-scale')})`;
    scene.style.willChange = 'auto';
    setPhase('through');
    window.setTimeout(() => setPhase('arrived'), 480);
  }

  if (!mounted) return null;

  const through = phase === 'through' || phase === 'arrived';

  return createPortal(
    <div
      className={phase === 'arrived' ? 'zoom-stage is-arrived' : 'zoom-stage'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="zoom-next">
        <Image src={slide.src} alt="" fill sizes="100vw" className="tour-photo" priority />
        <div className="tour-veil" aria-hidden="true" />
        <div className="zoom-headline tour-caption">
          <p className="eyebrow">
            Campus · {index + 1} / {slides.length}
          </p>
          <h2 id="tour-title">{slide.title}</h2>
          <p>{slide.copy}</p>
        </div>
        <div className="zoom-controls">
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
      <div
        ref={firstRef}
        className={through ? 'zoom-first is-through' : phase === 'zooming' ? 'zoom-first is-zooming' : 'zoom-first'}
        onAnimationEnd={onZoomEnd}
      >
        <p className="zoom-kicker">Hiraya campus</p>
        <button
          ref={windowRef}
          type="button"
          className="zoom-window"
          onClick={enterCampus}
          disabled={phase !== 'approach'}
          aria-label={`Step through the window into ${slide.title}`}
        >
          <Image src={slide.src} alt="" fill sizes="40vw" className="zoom-window-photo" priority />
        </button>
        <p className="zoom-hint">Tap the window to step inside</p>
      </div>
      <button type="button" className="zoom-close" onClick={onClose} aria-label="Close campus tour">
        ×
      </button>
    </div>,
    document.body,
  );
}
