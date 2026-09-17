import { useEffect, useRef, useState, type DragEvent } from 'react';
import { api } from '../lib/api';
import { Icons } from '../icons';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp';

export function ProfilePhotoField({
  userId,
  hasPhoto,
  cacheKey,
}: {
  userId?: string;
  hasPhoto?: boolean;
  cacheKey?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<'idle' | 'ready' | 'remove'>('idle');
  const [dragging, setDragging] = useState(false);
  const existing = userId && hasPhoto ? api.profileMediaUrl(userId, cacheKey || userId) : '';

  useEffect(() => {
    setPreview('');
    setFileName('');
    setStatus('idle');
  }, [userId, hasPhoto, cacheKey]);

  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview || (status === 'remove' ? '' : existing);

  function applyFile(file?: File | null) {
    if (!file || !file.size) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    setStatus('ready');
    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    applyFile(event.dataTransfer.files?.[0]);
  }

  function clearPhoto() {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview('');
    setFileName('');
    setStatus(existing ? 'remove' : 'idle');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="photo-upload form-span">
      <input
        ref={inputRef}
        className="photo-upload-input"
        type="file"
        name="photo"
        accept={ACCEPT}
        onChange={(event) => applyFile(event.target.files?.[0])}
      />
      {status === 'remove' ? <input type="hidden" name="removePhoto" value="1" /> : null}
      <div
        className={['photo-drop', dragging ? 'is-drag' : '', shown ? 'has-photo' : ''].filter(Boolean).join(' ')}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="photo-avatar-btn"
          onClick={() => inputRef.current?.click()}
          aria-label={shown ? 'Change profile photo' : 'Upload profile photo'}
        >
          <span className="photo-preview">
            {shown ? <img src={shown} alt="" /> : <span>Add photo</span>}
          </span>
          <span className="photo-overlay" aria-hidden>
            <Icons.camera width={18} height={18} />
          </span>
        </button>
        <div className="photo-copy">
          <p className="photo-lead">Click the photo or drop an image here</p>
          <p className="muted">JPG, PNG, or WEBP. Max 8 MB. Shown on mobile after they sign in.</p>
          {status === 'ready' ? (
            <p className="photo-status is-ready">Photo selected · {fileName}</p>
          ) : status === 'remove' ? (
            <p className="photo-status">Photo will be removed on save</p>
          ) : shown ? (
            <p className="photo-status">Current photo on file</p>
          ) : (
            <p className="photo-status">No photo yet</p>
          )}
          {shown || status === 'remove' ? (
            <button type="button" className="photo-remove-link" onClick={clearPhoto}>
              Remove photo
            </button>
          ) : (
            <button type="button" className="photo-remove-link" onClick={() => inputRef.current?.click()}>
              Browse files
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function fileFromForm(form: FormData, formEl?: HTMLFormElement | null): File | null {
  const listed = form.getAll('photo');
  for (const item of listed) {
    if (item instanceof File && item.size > 0) return item;
  }
  const input = formEl?.elements.namedItem('photo');
  if (input instanceof HTMLInputElement && input.files?.[0] && input.files[0].size > 0) {
    return input.files[0];
  }
  return null;
}

export async function saveAccountPhoto(userId: string | undefined, form: FormData, formEl?: HTMLFormElement | null) {
  if (!userId) return null;
  const photo = fileFromForm(form, formEl);
  const remove = form.get('removePhoto') === '1' || form.getAll('removePhoto').includes('1');
  if (photo) return api.uploadProfilePhoto(userId, photo, photo.name || 'photo.jpg');
  if (remove) return api.removeProfilePhoto(userId);
  return null;
}
