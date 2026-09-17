import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Caption } from '../typography';
import { colors, fonts, shadow, space } from '../../theme';
import { PressScale } from './motion';

export type HomeStat = {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function HomeStats({ items }: { items: HomeStat[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(168, Math.max(148, width * 0.42));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={styles.row}
    >
      {items.map((item) => (
        <PressScale
          key={item.key}
          onPress={item.onPress}
          style={[styles.card, { width: cardWidth }]}
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <View style={styles.badge}>
            <Ionicons name={item.icon} size={18} color={colors.green} />
          </View>
          <Caption style={styles.value} numberOfLines={2} maxFontSizeMultiplier={1.25}>
            {item.value}
          </Caption>
          <Caption style={styles.label} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {item.label}
          </Caption>
        </PressScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingRight: 4,
  },
  card: {
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: space.sm,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.22)',
    ...shadow.card,
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 2,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    color: colors.green,
    fontFamily: fonts.poppinsBold,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 4,
  },
  label: {
    color: colors.muted,
  },
});
