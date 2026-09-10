import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { studentDisplay } from '@hiraya/utils';
import { api, useAuth } from '../../src/auth';
import type { HirayaDatabase } from '@hiraya/types';
import { emptyStore } from '@hiraya/types';

export default function ChildrenTab() {
  const { user } = useAuth();
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  useEffect(() => {
    api.getStore().then(setStore).catch(() => undefined);
  }, []);
  const ids = store.parentStudents.filter((l) => l.parentId === user?.userId).map((l) => l.studentId);
  const kids = store.students.filter((s) => ids.includes(s.studentId) || s.parentId === user?.userId);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F7F1E1', padding: 16 }}>
      {kids.map((child) => (
        <Text key={child.studentId} style={{ padding: 12, backgroundColor: '#fffef8', marginBottom: 8, borderRadius: 12 }}>
          {studentDisplay(child)} · {child.program}
        </Text>
      ))}
    </ScrollView>
  );
}
