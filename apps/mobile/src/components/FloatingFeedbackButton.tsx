import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../theme';
import { useAuth } from '../auth';
import { isMobileParent } from '../rbac';

/** Parent-only shortcut to send feedback for teachers or Hiraya Kids Learning Center. */
export function FloatingFeedbackButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  if (!isMobileParent(user?.role)) return null;

  return (
    <Pressable
      onPress={() => router.push('/feedback')}
      accessibilityRole="button"
      accessibilityLabel="Send feedback"
      style={({ pressed }) => [
        styles.fab,
        shadow.card,
        {
          bottom: 58 + Math.max(insets.bottom, 10) + 16 + 66,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name="heart-outline" size={24} color={colors.cream} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 39,
    elevation: 8,
    borderWidth: 2,
    borderColor: colors.gold,
  },
});
