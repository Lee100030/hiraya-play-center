import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';

export async function fileFromPhotoSrc(src: string, name = 'photo.jpg') {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not open that photo.');
  const blob = await res.blob();
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg';
  const base = name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}${ext}`, { type });
}

export type PhotoCropShape = 'portrait' | 'square';

const SHAPES: { id: PhotoCropShape; label: string; ratio: number }[] = [
  { id: 'portrait', label: 'Portrait', ratio: 3 / 4 },
  { id: 'square', label: 'Square', ratio: 1 },
];

const VIEW_W = 280;

function rotateBitmap(source: CanvasImageSource, width: number, height: number, deg: number) {
  const turn = ((deg % 360) + 360) % 360;
  const swap = turn === 90 || turn === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare that photo.');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(source, -width / 2, -height / 2);
  return canvas;
}

function clampPan(panX: number, panY: number, scale: number, imgW: number, imgH: number, viewW: number, viewH: number) {
  const limitX = Math.max(0, (imgW * scale - viewW) / 2);
  const limitY = Math.max(0, (imgH * scale - viewH) / 2);
  return {
    x: Math.min(limitX, Math.max(-limitX, panX)),
    y: Math.min(limitY, Math.max(-limitY, panY)),
  };
}

export function PhotoCropDialog({
  file,
  title = 'Adjust photo',
  onCancel,
  onApply,
}: {
  file: File;
  title?: string;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const openedAt = useRef(Date.now());
  const replaceRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [working, setWorking] = useState(file);
  const [previewUrl, setPreviewUrl] = useState('');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shape, setShape] = useState<PhotoCropShape>('portrait');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const ratio = SHAPES.find((item) => item.id === shape)?.ratio || 3 / 4;
  const viewH = Math.round(VIEW_W / ratio);
  const source = useMemo(() => {
    if (!image) return null;
    if (!rotation) return { node: image as CanvasImageSource, width: image.naturalWidth, height: image.naturalHeight };
    const canvas = rotateBitmap(image, image.naturalWidth, image.naturalHeight, rotation);
    return { node: canvas, width: canvas.width, height: canvas.height };
  }, [image, rotation]);
  const previewSrc = source?.node instanceof HTMLCanvasElement ? source.node.toDataURL('image/jpeg', 0.92) : previewUrl;
  const cover = source ? Math.max(VIEW_W / source.width, viewH / source.height) : 1;
  const scale = cover * zoom;

  useEffect(() => {
    setWorking(file);
  }, [file]);

  useEffect(() => {
    let live = true;
    const url = URL.createObjectURL(working);
    const img = new Image();
    setError('');
    setImage(null);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setPreviewUrl(url);
    img.onload = () => {
      if (live) setImage(img);
    };
    img.onerror = () => {
      if (live) setError('That image could not be opened. Try a JPG or PNG.');
    };
    img.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [working]);

  useEffect(() => {
    if (!source) return;
    setPan((current) => clampPan(current.x, current.y, cover * zoom, source.width, source.height, VIEW_W, viewH));
  }, [source, cover, zoom, viewH]);

  const movePan = useCallback(
    (nextX: number, nextY: number) => {
      if (!source) return;
      setPan(clampPan(nextX, nextY, scale, source.width, source.height, VIEW_W, viewH));
    },
    [source, scale, viewH],
  );

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!source) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    movePan(drag.current.panX + (event.clientX - drag.current.x), drag.current.panY + (event.clientY - drag.current.y));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((value) => Math.min(4, Math.max(1, Number((value + (event.deltaY > 0 ? -0.08 : 0.08)).toFixed(2)))));
  }

  async function apply() {
    if (!source) return;
    setBusy(true);
    setError('');
    try {
      const outW = 1200;
      const outH = shape === 'square' ? 1200 : 1600;
      const left = (VIEW_W - source.width * scale) / 2 + pan.x;
      const top = (viewH - source.height * scale) / 2 + pan.y;
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not crop that photo.');
      ctx.fillStyle = '#0b1f14';
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source.node, -left / scale, -top / scale, VIEW_W / scale, viewH / scale, 0, 0, outW, outH);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((next) => (next ? resolve(next) : reject(new Error('Could not save the cropped photo.'))), 'image/jpeg', 0.9);
      });
      const name = (working.name || file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
      onApply(new File([blob], name, { type: 'image/jpeg' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop that photo.');
      setBusy(false);
    }
  }

  const drawW = source ? source.width * scale : 0;
  const drawH = source ? source.height * scale : 0;

  const node = (
    <div
      className="photo-crop-overlay"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        if (busy) return;
        if (Date.now() - openedAt.current < 500) return;
        if (event.target === event.currentTarget) onCancel();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="photo-crop-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="photo-crop-head">
          <div>
            <p className="photo-crop-kicker">Profile photo</p>
            <h2 id="photo-crop-title">{title}</h2>
            <p>Drag to reposition. Zoom or rotate until the face sits in the frame.</p>
          </div>
          <button type="button" className="photo-crop-close" onClick={onCancel} aria-label="Cancel photo">
            ×
          </button>
        </header>
        {error ? <p className="hlc-field-error">{error}</p> : null}
        <div className="photo-crop-shapes" role="group" aria-label="Crop shape">
          {SHAPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={['hlc-btn', shape === item.id ? 'hlc-btn-primary' : 'hlc-btn-ghost'].join(' ')}
              onClick={() => setShape(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="photo-crop-stage">
          <div
            className={['photo-crop-view', `is-${shape}`].join(' ')}
            style={{ width: VIEW_W, height: viewH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {source && previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: (VIEW_W - drawW) / 2 + pan.x,
                  top: (viewH - drawH) / 2 + pan.y,
                  width: drawW,
                  height: drawH,
                }}
              />
            ) : (
              <p className="photo-crop-loading">Opening photo…</p>
            )}
            <span className="photo-crop-guide" aria-hidden />
          </div>
        </div>
        <div className="photo-crop-tools">
          <label className="photo-crop-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              disabled={!source}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className="hlc-btn hlc-btn-ghost"
            disabled={!source}
            onClick={() => {
              setRotation((value) => (value + 90) % 360);
              setPan({ x: 0, y: 0 });
            }}
          >
            Rotate
          </button>
          <button
            type="button"
            className="hlc-btn hlc-btn-ghost"
            disabled={!source}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setRotation(0);
            }}
          >
            Reset
          </button>
        </div>
        <footer className="photo-crop-actions">
          <input
            ref={replaceRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
            className="photo-file-input"
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = '';
              if (next) setWorking(next);
            }}
          />
          <button type="button" className="hlc-btn hlc-btn-ghost" onClick={() => replaceRef.current?.click()} disabled={busy}>
            Choose another
          </button>
          <button type="button" className="hlc-btn hlc-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="hlc-btn hlc-btn-primary" onClick={() => void apply()} disabled={!source || busy}>
            {busy ? 'Saving…' : 'Update'}
          </button>
        </footer>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
