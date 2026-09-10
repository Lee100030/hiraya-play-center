import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, useAuth } from '../../src/auth';
import { emptyStore, type HirayaDatabase } from '@hiraya/types';

export default function HomeTab() {
  const { user } = useAuth();
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  useEffect(() => {
    api.getStore().then(setStore).catch(() => undefined);
  }, []);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F7F1E1', padding: 16 }}>
      <Text style={{ fontSize: 28, color: '#0B3D2E' }}>Hello, {user?.fullname}</Text>
      <View style={{ marginTop: 16, backgroundColor: '#fffef8', padding: 16, borderRadius: 16 }}>
        <Text>Children records: {store.students.length}</Text>
        <Text>Schedules: {store.schedules.length}</Text>
        <Text>Alerts: {store.alerts.length}</Text>
      </View>
    </ScrollView>
  );
}
