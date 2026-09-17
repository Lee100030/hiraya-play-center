import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const ease = Easing.bezier(0.22, 1, 0.36, 1);

export function Enter({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(520).delay(index * 72).easing(ease)} style={style}>
      {children}
    </Animated.View>
  );
}

export function PressScale({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 110, easing: ease });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 180, easing: ease });
      }}
      style={style}
    >
      <Animated.View style={animated}>{children}</Animated.View>
    </Pressable>
  );
}
