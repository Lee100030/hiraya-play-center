import { useState } from 'react';
import { PersonAvatar } from './PersonAvatar';

export type PhotoCardPerson = {
  id: string;
  name: string;
  photo?: string;
  role?: string;
};

export function PhotoCardPicker({
  name = 'teacherIds',
  people,
  defaultSelected,
}: {
  name?: string;
  people: PhotoCardPerson[];
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = useState(() => new Set((defaultSelected || []).filter(Boolean)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!people.length) {
    return <p className="photo-pick-empty">No teachers to assign.</p>;
  }

  return (
    <div className="photo-pick">
      <div className="photo-pick-grid" role="listbox" aria-multiselectable="true" aria-label="Teachers">
        {people.map((person) => {
          const on = selected.has(person.id);
          return (
            <button
              key={person.id}
              type="button"
              role="option"
              aria-selected={on}
              className={['photo-pick-card', on ? 'is-selected' : ''].filter(Boolean).join(' ')}
              onClick={() => toggle(person.id)}
            >
              {on ? (
                <span className="photo-pick-check" aria-hidden>
                  ✓
                </span>
              ) : null}
              <PersonAvatar name={person.name} photo={person.photo} size="lg" />
              <strong>{person.name}</strong>
              {person.role ? <span className="photo-pick-role">{person.role}</span> : null}
            </button>
          );
        })}
      </div>
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
