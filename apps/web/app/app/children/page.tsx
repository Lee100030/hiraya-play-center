'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';
import { studentDisplay } from '@hiraya/utils';

export default function ChildrenPage() {
  const { user } = useAuth();
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  const ids = store.parentStudents.filter((l) => l.parentId === user?.userId && l.isActive).map((l) => l.studentId);
  const children = store.students.filter((s) => ids.includes(s.studentId) || s.parentId === user?.userId);
  return (
    <>
      <h1>Children</h1>
      <div className="grid-cards">
        {children.map((child) => (
          <Card key={child.studentId} title={studentDisplay(child)}>
            <p>{child.program}</p>
            <p>{child.status}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
