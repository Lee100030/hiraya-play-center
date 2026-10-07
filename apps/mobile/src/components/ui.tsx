import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '../theme';
import { statusTone } from '@hiraya/utils';
import { Body, Caption, Heading, Label } from './typography';

export function Screen({
  children,
  padded = true,
  scroll = true,
}: {
  children: ReactNode;
  padded?: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = 32 + 58 + Math.max(insets.bottom, 10);
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, padded && styles.pad, { paddingBottom: bottomPad }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.pad, { paddingBottom: bottomPad }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {body}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Heading>{title}</Heading>
      {action}
    </View>
  );
}

export function EmptyValue({ label = 'Not provided' }: { label?: string }) {
  return <Text style={styles.emptyValue}>{label}</Text>;
}

export function StatusBadge({ status }: { status?: string }) {
  const raw = (status || '').trim().replace(/_/g, ' ');
  if (!raw || raw === '—') {
    return <EmptyValue label="Not assigned" />;
  }
  const tone = statusTone(raw);
  const toneStyle =
    tone === 'success' ? styles.badgeOk : tone === 'warn' ? styles.badgeWarn : tone === 'danger' ? styles.badgeDanger : styles.badgeMuted;
  const textStyle =
    tone === 'success' ? styles.badgeOkText : tone === 'warn' ? styles.badgeWarnText : tone === 'danger' ? styles.badgeDangerText : styles.badgeMutedText;
  const label = raw.replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.badgeText, textStyle]}>{label}</Text>
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={6}
      android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && !loading ? styles.btnPressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.green : colors.greenDeep} />
      ) : (
        <Text pointerEvents="none" style={[styles.btnText, variant === 'ghost' && { color: colors.green }, variant === 'danger' && { color: colors.white }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  required,
  accessory,
  onFocus,
  onBlur,
  style,
  multiline,
  ...props
}: TextInputProps & { label: string; required?: boolean; accessory?: ReactNode }) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space.md }}>
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      <View
        style={[styles.inputShell, multiline ? styles.inputShellMultiline : null, focused && styles.inputShellFocus]}
      >
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.placeholder}
          showSoftInputOnFocus
          underlineColorAndroid="transparent"
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            accessory ? styles.inputWithAccessory : null,
            style,
          ]}
        />
        {accessory ? <View style={styles.inputAccessory} pointerEvents="box-none">{accessory}</View> : null}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
  fill = true,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  fill?: boolean;
}) {
  return (
    <View style={[styles.empty, fill && styles.emptyFill]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon || 'file-tray-outline'} size={32} color={colors.green} />
      </View>
      <Heading style={{ marginTop: 12, textAlign: 'center' }}>{title}</Heading>
      {hint ? <Caption style={{ textAlign: 'center', maxWidth: 280 }}>{hint}</Caption> : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="ghost" onPress={onAction} style={{ marginTop: 16, alignSelf: 'center', minWidth: 200 }} />
      ) : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.green} />
      <Caption style={{ marginTop: 8 }}>{label}</Caption>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <Heading>Something went wrong</Heading>
      <Body style={{ marginVertical: 8 }}>{message}</Body>
      <AppButton label="Try again" onPress={onRetry} />
    </Card>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.track} accessibilityLabel={`Progress ${width} percent`}>
      <View style={[styles.fillBar, { width: `${width}%` }]} />
    </View>
  );
}

export function RowLink({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.rowLink} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.green} />
      </View>
      <View style={styles.rowCopy}>
        <Body numberOfLines={1}>{label}</Body>
        <Caption numberOfLines={1}>{hint || ' '}</Caption>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export { AppHeader } from './AppHeader';
export { SettingsButton } from './SettingsButton';
export { Body, Caption, Heading, Kicker, Label, Title } from './typography';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  pad: { paddingHorizontal: space.lg, paddingTop: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: space.sm,
    ...shadow.card,
  },
  sectionRow: {
    marginTop: space.md,
    marginBottom: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.poppinsSemiBold, fontSize: 12 },
  badgeOk: { backgroundColor: colors.successSoft },
  badgeWarn: { backgroundColor: colors.warnSoft },
  badgeDanger: { backgroundColor: colors.dangerSoft },
  badgeMuted: { backgroundColor: '#eef1ee' },
  badgeOkText: { color: colors.success },
  badgeWarnText: { color: colors.warn },
  badgeDangerText: { color: colors.danger },
  badgeMutedText: { color: colors.muted },
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gold },
  btnDanger: { backgroundColor: colors.danger },
  btnDisabled: { opacity: 0.55 },
  btnPressed: { opacity: 0.88 },
  btnText: { fontFamily: fonts.poppinsBold, color: colors.greenDeep, fontSize: 15 },
  inputShell: {
    position: 'relative',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  inputShellMultiline: {
    justifyContent: 'flex-start',
    minHeight: 120,
  },
  inputShellFocus: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 8 : 12,
    paddingBottom: Platform.OS === 'android' ? 8 : 12,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? fonts.poppinsRegular : undefined,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  inputWithAccessory: { paddingRight: 48 },
  inputAccessory: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyFill: {
    flexGrow: 1,
    minHeight: 320,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyValue: {
    fontFamily: fonts.outfitRegular,
    fontSize: 15,
    color: colors.muted,
    fontWeight: '500',
  },
  track: { height: 10, backgroundColor: colors.goldSoft, borderRadius: radius.pill, overflow: 'hidden' },
  fillBar: { height: 10, backgroundColor: colors.green, borderRadius: radius.pill },
  rowLink: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  rowCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
