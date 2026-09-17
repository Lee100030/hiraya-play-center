'use client';

import { useEffect, useRef } from 'react';
import './AntigravityField.css';

type Particle = {
  x: number;
  y: number;
  bx: number;
  by: number;
  vx: number;
  vy: number;
  size: number;
  depth: number;
  phase: number;
  color: string;
};

const COLORS = ['#C9A227', '#D4AF37', '#F5F1E6', '#8FAF8A', '#E8D48B'];

function fillCapsule(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const radius = height / 2;
  const x = -width / 2;
  const y = -height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + radius, y + height);
  ctx.arc(x + radius, y + radius, radius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
}

export function AntigravityField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const mouse = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.35, active: false };
    const target = { ...mouse };
    let particles: Particle[] = [];
    let raf = 0;
    let last = performance.now();

    const count = window.innerWidth < 800 ? 70 : 160;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const box = canvas.parentElement?.getBoundingClientRect();
      const w = Math.max(1, Math.floor(box?.width || window.innerWidth));
      const h = Math.max(1, Math.floor(box?.height || window.innerHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!particles.length) {
        particles = Array.from({ length: count }, () => spawn(w, h));
      }
    };

    const spawn = (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      bx: Math.random() * w,
      by: Math.random() * h,
      vx: 0,
      vy: -(0.15 + Math.random() * 0.35),
      size: 2.2 + Math.random() * 5.5,
      depth: 0.45 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#d4af37',
    });

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      mouse.active = true;
      const px = e.clientX / Math.max(window.innerWidth, 1);
      const py = e.clientY / Math.max(window.innerHeight, 1);
      document.documentElement.style.setProperty('--px', px.toFixed(4));
      document.documentElement.style.setProperty('--py', py.toFixed(4));
    };
    const onLeave = () => {
      mouse.active = false;
    };

    const magnet = () => (window.innerWidth < 800 ? 140 : 210);
    const ring = () => (window.innerWidth < 800 ? 42 : 64);

    const loop = (now: number) => {
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      mouse.x += (target.x - mouse.x) * 0.18;
      mouse.y += (target.y - mouse.y) * 0.18;

      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const radius = magnet();
      const orbit = ring();
      ctx.clearRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 140);
      glow.addColorStop(0, 'rgba(212, 175, 55, 0.16)');
      glow.addColorStop(0.45, 'rgba(201, 162, 39, 0.04)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mouse.x - 140, mouse.y - 140, 280, 280);

      for (const p of particles) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (mouse.active && dist < radius) {
          const pull = (1 - dist / radius) * 0.22 * p.depth;
          const ang = p.phase + now * 0.0018;
          const tx = mouse.x + Math.cos(ang) * orbit * p.depth;
          const ty = mouse.y + Math.sin(ang) * orbit * p.depth * 0.72;
          p.vx += (tx - p.x) * pull;
          p.vy += (ty - p.y) * pull;
          p.vy -= 0.18 * pull * 4;
        } else {
          p.vx += (p.bx - p.x) * 0.012;
          p.vy += (p.by - p.y) * 0.012;
          p.vy -= 0.04 * p.depth;
          p.bx += Math.sin(now * 0.0004 + p.phase) * 0.05;
        }

        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.y < -20) {
          p.y = h + 12;
          p.by = Math.random() * h;
          p.x = Math.random() * w;
          p.bx = p.x;
        }

        const len = Math.hypot(p.vx, p.vy);
        const rot = Math.atan2(p.vy, p.vx);
        const capW = p.size * (2.2 + Math.min(len * 0.35, 2.4));
        const capH = p.size * 0.72;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.5 + p.depth * 0.32;
        fillCapsule(ctx, capW, capH);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="antigravity-field" aria-hidden="true" />;
}
