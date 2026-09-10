'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function GalleryPage() {
  const [items, setItems] = useState<{ itemId: string; title: string; caption: string }[]>([]);
  useEffect(() => {
    api
      .getPublicSite()
      .then((site) => setItems(site.gallery || []))
      .catch(() => setItems([]));
  }, []);

  return (
    <PublicChrome>
      <h1>Activities</h1>
      {items.length === 0 ? (
        <p>Published gallery images appear here once the website CMS has items.</p>
      ) : (
        <div className="program-grid">
          {items.map((item) => (
            <article key={item.itemId} className="info-card">
              <h2>{item.title}</h2>
              <p>{item.caption}</p>
            </article>
          ))}
        </div>
      )}
    </PublicChrome>
  );
}
