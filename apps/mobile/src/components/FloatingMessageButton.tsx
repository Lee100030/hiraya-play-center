import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../theme';
import { useAuth } from '../auth';
import { useCenter } from '../store';

export function FloatingMessageButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { store } = useCenter();
  const unread = store.alerts.filter(
    (item) => item.kind === 'direct' && item.recipientId === user?.userId && !item.read && item.status !== 'sent',
  ).length;

  return (
    <Pressable
      onPress={() => router.push('/messages')}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Messages, ${unread} unread` : 'Messages'}
      style={({ pressed }) => [
        styles.fab,
        shadow.card,
        {
          bottom: 58 + Math.max(insets.bottom, 10) + 16,
          opacity: pressed ? 0.9 : 1,
          shadowOpacity: 0.28,
          shadowRadius: 16,
          elevation: 10,
        },
      ]}
    >
      <Ionicons name="chatbubble-ellipses" size={26} color={colors.greenDeep} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 99,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
