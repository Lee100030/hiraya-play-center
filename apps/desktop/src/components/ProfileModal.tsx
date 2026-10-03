import { PersonAvatar, PhotoCropDialog, fileFromPhotoSrc, StatusBadge, emptyCell } from '@hiraya/ui';
import { useRef, useState, type ReactNode } from 'react';
import { Icons } from '../icons';

export function ProfileFact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <div className="profile-fact">
      <span>{label}</span>
      <div>{empty ? emptyCell(null) : children}</div>
    </div>
  );
}

export function ProfileModal({
  title,
  photo,
  name,
  subtitle,
  status,
  active,
  onToggleActive,
  toggleBusy,
  children,
  extra,
  onClose,
  actions,
  photoEditable,
  photoBusy,
  onPickPhoto,
  onRemovePhoto,
}: {
  title: string;
  photo?: string;
  name: string;
  subtitle?: string;
  status?: string;
  active?: boolean;
  onToggleActive?: (next: boolean) => void;
  toggleBusy?: boolean;
  children: ReactNode;
  extra?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
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
    <div className="modal-backdrop" role="presentation" onClick={cropFile ? undefined : onClose}>
      <div
        className="profile-split"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-split-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={['profile-split-photo', canEditPhoto ? 'is-editable' : ''].filter(Boolean).join(' ')} aria-hidden={!photo && !canEditPhoto}>
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
                <Icons.camera width={16} height={16} />
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
          <button type="button" className="icon-btn profile-split-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <p className="profile-split-kicker">{title}</p>
          <h2 id="profile-split-title" className="profile-modal-name">
            {name}
          </h2>
          {subtitle ? <p className="desk-modal-meta">{subtitle}</p> : null}
          <div className="profile-status-row">
            {status ? <StatusBadge status={status} /> : null}
            {onToggleActive ? (
              <label className="status-switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={toggleBusy}
                  onChange={(event) => onToggleActive(event.target.checked)}
                />
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </label>
            ) : null}
          </div>
          <div className="profile-facts">{children}</div>
          {extra}
          <div className="profile-modal-actions">{actions}</div>
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
