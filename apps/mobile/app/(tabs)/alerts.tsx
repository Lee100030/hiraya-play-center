import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/auth';
import { emptyStore, type HirayaDatabase } from '@hiraya/types';

export default function AlertsTab() {
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStore(await api.getStore());
    } catch {
      /* keep last */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows = [...store.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F7F1E1', padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {rows.length === 0 ? (
        <Text style={{ color: '#0B3D2E' }}>No messages yet. Pull down to refresh.</Text>
      ) : (
        rows.map((row) => (
          <View
            key={row.alertId}
            style={{ padding: 12, backgroundColor: '#fffef8', marginBottom: 8, borderRadius: 12 }}
          >
            <Text style={{ fontWeight: '600', color: '#0B3D2E' }}>{row.title}</Text>
            <Text style={{ marginTop: 6, color: '#1a2e26' }}>{row.message}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
