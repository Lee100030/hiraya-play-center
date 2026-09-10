import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { api } from '../../src/auth';
import { emptyStore, type HirayaDatabase } from '@hiraya/types';

export default function ScheduleTab() {
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  useEffect(() => {
    api.getStore().then(setStore).catch(() => undefined);
  }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F7F1E1', padding: 16 }}>
      {store.schedules.map((row) => (
        <Text key={row.scheduleId} style={{ padding: 12, backgroundColor: '#fffef8', marginBottom: 8, borderRadius: 12 }}>
          {row.title} · {row.startAt}
        </Text>
      ))}
    </ScrollView>
  );
}
