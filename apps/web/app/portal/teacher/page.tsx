'use client';

import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';

export default function TeacherPortalPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Teacher portal</h1>
      <div className="grid-cards">
        <Card title="Classes">{store.classes.length}</Card>
        <Card title="Modules">{store.learningModules.length}</Card>
        <Card title="Tasks">{store.schedules.filter((s) => s.kind === 'teacherTask').length}</Card>
      </div>
    </>
  );
}
