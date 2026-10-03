'use client';

import { useEffect, useRef, useState } from 'react';

export function AboutFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const mark = () => setMissing(true);
    video.addEventListener('error', mark);
    if (video.error) mark();
    return () => video.removeEventListener('error', mark);
  }, []);

  if (missing) {
    return (
      <div className="about-video-empty">
        <p>Campus film</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="about-video"
      controls
      playsInline
      preload="metadata"
      src="/api/public/intro-video"
    >
      Campus film
    </video>
  );
}
