import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import type { SystemAlert } from '@hiraya/types';
import { Body, Caption, Heading, Label } from '../typography';
import { formatWhen } from '../../selectors';
import { colors, fonts, space } from '../../theme';
import { PressScale } from './motion';

function iconFor(kind?: string): keyof typeof Ionicons.glyphMap {
  const key = (kind || '').toLowerCase();
  if (key.includes('attendance')) return 'checkmark-circle-outline';
  if (key.includes('announce') || key.includes('news')) return 'megaphone-outline';
  if (key.includes('progress') || key.includes('report')) return 'trending-up-outline';
  if (key.includes('schedule') || key.includes('event')) return 'calendar-outline';
  if (key.includes('payment')) return 'card-outline';
  if (key.includes('message') || key.includes('mail')) return 'chatbubble-ellipses-outline';
  return 'notifications-outline';
}

export function HomeActivity({
  items,
  onOpen,
}: {
  items: SystemAlert[];
  onOpen: () => void;
}) {
  return (
    <View>
      <Label style={styles.kicker}>Recent activity</Label>
      <Heading style={styles.heading}>Latest from the center</Heading>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Image source={require('../../../assets/hiraya-crest.png')} style={styles.emptyCrest} />
          <Body style={styles.emptyText}>No new updates yet — check back soon</Body>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => (
            <PressScale
              key={item.alertId}
              onPress={onOpen}
              style={[styles.row, index === items.length - 1 && styles.rowLast]}
              accessibilityLabel={`${item.title || item.kind}. ${formatWhen(item.createdAt)}`}
            >
              <View style={styles.icon}>
                <Ionicons name={iconFor(item.kind)} size={18} color={colors.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body numberOfLines={2} maxFontSizeMultiplier={1.3}>
                  {item.title || item.message || item.kind}
                </Body>
                <Caption maxFontSizeMultiplier={1.3}>{formatWhen(item.createdAt)}</Caption>
              </View>
            </PressScale>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.gold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heading: {
    marginBottom: space.sm,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.18)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11, 31, 20, 0.08)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.18)',
  },
  emptyCrest: {
    width: 72,
    height: 72,
    opacity: 0.28,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontFamily: fonts.poppinsRegular,
  },
});
