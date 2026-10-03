import { useEffect, useState } from 'react';

export type PersonAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export function personInitial(name?: string | null) {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
}

export function PersonAvatar({
  name,
  photo,
  size = 'sm',
  shape = 'circle',
  hint,
  alt,
}: {
  name?: string | null;
  photo?: string | null;
  size?: PersonAvatarSize;
  shape?: 'circle' | 'bleed';
  hint?: boolean;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = (photo || '').trim();
  const showPhoto = Boolean(src) && !failed;
  const initial = personInitial(name);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span className={`hlc-avatar hlc-avatar-${size} hlc-avatar-${shape} ${showPhoto ? 'has-photo' : 'is-fallback'}`}>
      {showPhoto ? (
        <img src={src} alt={alt || ''} onError={() => setFailed(true)} />
      ) : (
        <>
          <span className="hlc-avatar-wash" aria-hidden="true" />
          <span className="hlc-avatar-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none">
              <circle cx="12" cy="8.2" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M5.5 18.5c1.2-3 3.5-4.5 6.5-4.5s5.3 1.5 6.5 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="hlc-avatar-initial">{initial}</span>
        </>
      )}
      {hint && !showPhoto ? <span className="hlc-avatar-hint">Add photo</span> : null}
    </span>
  );
}
