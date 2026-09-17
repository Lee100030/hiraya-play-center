import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Caption, Title } from './typography';
import { SettingsButton } from './SettingsButton';
import { space } from '../theme';

/**
 * Shared tab header:
 * Home uses its own hero (large photo). Profile has no settings control.
 * Calendar, Modules/Progress, and News/Alerts use this row: title + optional
 * action + branded settings (opens Profile).
 */
export function AppHeader({
  title,
  subtitle,
  action,
  showSettings = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showSettings?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Title maxFontSizeMultiplier={1.2}>{title}</Title>
        {subtitle ? <Caption style={styles.sub}>{subtitle}</Caption> : null}
      </View>
      <View style={styles.actions}>
        {action}
        {showSettings ? <SettingsButton onPress={() => router.push('/(tabs)/profile')} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  sub: { marginTop: 4 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
});
