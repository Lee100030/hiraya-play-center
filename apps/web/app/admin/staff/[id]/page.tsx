'use client';

import { TeacherWorkspace } from '@/components/admin/TeacherWorkspace';
import { useParams } from 'next/navigation';

export default function TeacherWorkspaceRoute() {
  const { id } = useParams<{ id: string }>();
  return <TeacherWorkspace teacherId={id} />;
}
