'use client';

import { useStore } from '@/components/StoreProvider';
import { Card, Loading, StatusBadge } from '@hiraya/ui';

export default function WebsiteCmsPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Website CMS</h1>
      <Card title="Landing">
        <h2>{store.settings.welcomeTitle}</h2>
        <p>{store.settings.welcomeMessage}</p>
      </Card>
      <Card title="About">
        <h2>{store.settings.aboutTitle}</h2>
        <p>{store.settings.mission}</p>
        <p>{store.settings.vision}</p>
      </Card>
      <h2>Gallery items</h2>
      {store.websiteGallery.map((item) => (
        <p key={item.itemId}>
          {item.title} <StatusBadge status={item.status} />
        </p>
      ))}
    </>
  );
}
