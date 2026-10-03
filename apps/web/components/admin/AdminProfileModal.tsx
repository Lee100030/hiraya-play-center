'use client';

import { Button, PersonAvatar, PhotoCropDialog, fileFromPhotoSrc, StatusBadge, emptyCell } from '@hiraya/ui';
import { useRef, useState, type ReactNode } from 'react';

export function AdminProfileFact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <div className="profile-fact">
      <span>{label}</span>
      <div>{empty ? emptyCell(null) : children}</div>
    </div>
  );
}

export function AdminProfileModal({
  title,
  name,
  subtitle,
  status,
  photo,
  active,
  onToggleActive,
  onClose,
  actions,
  extra,
  children,
  photoEditable,
  photoBusy,
  onPickPhoto,
  onRemovePhoto,
}: {
  title: string;
  name: string;
  subtitle?: string;
  status?: string;
  photo?: string;
  active?: boolean;
  onToggleActive?: (next: boolean) => void;
  onClose: () => void;
  actions?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  photoEditable?: boolean;
  photoBusy?: boolean;
  onPickPhoto?: (file: File) => void;
  onRemovePhoto?: () => void;
}) {
  const isActive = active ?? (status || '').toLowerCase() === 'active';
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const canEditPhoto = Boolean(photoEditable && onPickPhoto);

  async function openUpdate() {
    if (!photo) {
      inputRef.current?.click();
      return;
    }
    setUpdating(true);
    try {
      setCropFile(await fileFromPhotoSrc(photo, 'photo.jpg'));
    } catch {
      inputRef.current?.click();
    } finally {
      setUpdating(false);
    }
  }
  return (
    <>
    <div className="admin-modal-overlay" onClick={cropFile ? undefined : onClose} role="presentation">
      <div className="profile-split" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title" onClick={(event) => event.stopPropagation()}>
        <div className={['profile-split-photo', canEditPhoto ? 'is-editable' : ''].filter(Boolean).join(' ')}>
          {canEditPhoto ? (
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
              className="photo-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) setCropFile(file);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : null}
          <PersonAvatar name={name} photo={photo} shape="bleed" size="xl" />
          {canEditPhoto ? (
            <div className="profile-split-photo-tools">
              <button
                type="button"
                className="profile-photo-edit"
                disabled={photoBusy || updating}
                onClick={() => (photo ? void openUpdate() : inputRef.current?.click())}
              >
                {photoBusy || updating ? 'Opening…' : photo ? 'Update' : 'Add photo'}
              </button>
              {photo ? (
                <button
                  type="button"
                  className="profile-photo-change"
                  disabled={photoBusy || updating}
                  onClick={() => inputRef.current?.click()}
                >
                  Change
                </button>
              ) : null}
              {photo && onRemovePhoto ? (
                <button type="button" className="profile-photo-remove" disabled={photoBusy} onClick={onRemovePhoto}>
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="profile-split-panel">
          <button type="button" className="admin-modal-close profile-split-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <p className="profile-split-kicker">{title}</p>
          <h2 id="admin-profile-title" className="profile-modal-name">
            {name}
          </h2>
          {subtitle ? <p className="desk-modal-meta">{subtitle}</p> : null}
          <div className="profile-status-row">
            {status ? <StatusBadge status={status} /> : null}
            {onToggleActive ? (
              <label className="status-switch">
                <input type="checkbox" checked={isActive} onChange={(event) => onToggleActive(event.target.checked)} />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </label>
            ) : null}
          </div>
          <div className="profile-facts">{children}</div>
          {extra}
          <div className="profile-modal-actions">
            {actions || (
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
      {cropFile ? (
        <PhotoCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(next) => {
            setCropFile(null);
            onPickPhoto?.(next);
          }}
        />
      ) : null}
    </>
  );
}
