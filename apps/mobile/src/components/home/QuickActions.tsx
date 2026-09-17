import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Caption, Heading, Label } from '../typography';
import { colors, fonts, space } from '../../theme';
import { PressScale } from './motion';

export type HomeAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function HomeQuickActions({ items }: { items: HomeAction[] }) {
  const { width } = useWindowDimensions();
  const cellWidth = Math.floor((width - space.lg * 2 - 12) / 2);

  return (
    <View>
      <Label style={styles.kicker}>Quick actions</Label>
      <Heading style={styles.heading}>What would you like to do?</Heading>
      <View style={styles.grid}>
        {items.map((item) => (
          <PressScale
            key={item.key}
            onPress={item.onPress}
            style={[styles.cell, { width: cellWidth }]}
            accessibilityLabel={item.label}
          >
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={22} color={colors.green} />
            </View>
            <Caption
              style={styles.label}
              numberOfLines={2}
              maxFontSizeMultiplier={1.1}
              android_hyphenationFrequency="none"
              textBreakStrategy="simple"
            >
              {item.label}
            </Caption>
          </PressScale>
        ))}
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 112,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: {
    textAlign: 'center',
    color: colors.green,
    fontFamily: fonts.poppinsSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
});
