import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayName, teachersForStudents } from '@hiraya/utils';
import { AppButton, Body, Caption, Card, Screen, Title } from '../src/components/ui';
import { Label } from '../src/components/typography';
import { api, useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { isMobileParent } from '../src/rbac';
import { friendlyError } from '../src/selectors';
import { colors, fonts, radius, space } from '../src/theme';

const CENTER_TARGET = '__center__';

export default function FeedbackScreen() {
  const { user } = useAuth();
  const { store, children } = useCenter();
  const insets = useSafeAreaInsets();
  const teachers = useMemo(
    () => teachersForStudents(store, children.map((item) => item.studentId)),
    [store, children],
  );
  const [target, setTarget] = useState(CENTER_TARGET);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isMobileParent(user?.role)) {
    return (
      <Screen>
        <Title>Feedback</Title>
        <Caption>Parents use this screen to share feedback with teachers or Hiraya Kids Learning Center.</Caption>
      </Screen>
    );
  }

  async function submit() {
    const body = message.trim();
    if (body.length < 3) {
      setError('Write a short message so we know how to help.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.sendParentFeedback({
        targetType: target === CENTER_TARGET ? 'center' : 'teacher',
        teacherId: target === CENTER_TARGET ? '' : target,
        rating,
        message: body,
      });
      setMessage('');
      setRating(0);
      Alert.alert('Thank you', 'Your feedback was sent. The center team will review it.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const bottomPad = 32 + Math.max(insets.bottom, 10);

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: bottomPad }}
        >
          <Title>Send feedback</Title>
          <Caption style={{ marginBottom: space.md }}>
            Share appreciation or concerns with a teacher, or with Hiraya Kids Learning Center.
          </Caption>

          <Label>Your message *</Label>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="What went well, or what can we improve?"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            showSoftInputOnFocus
            underlineColorAndroid="transparent"
            style={styles.messageBox}
            accessibilityLabel="Your message"
          />

          <Body style={[styles.label, { marginTop: space.sm }]}>Rating (optional)</Body>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setRating((current) => (current === value ? 0 : value))}
                accessibilityRole="button"
                accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                style={styles.starHit}
              >
                <Text style={[styles.star, rating >= value && styles.starOn]}>{rating >= value ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>

          <Body style={styles.label}>Send to</Body>
          <Pressable
            onPress={() => setTarget(CENTER_TARGET)}
            style={[styles.choice, target === CENTER_TARGET && styles.choiceOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: target === CENTER_TARGET }}
          >
            <Body>Hiraya Kids Learning Center</Body>
            <Caption>Center staff and administrators</Caption>
          </Pressable>
          {teachers.map((teacher) => {
            const selected = target === teacher.userId;
            return (
              <Pressable
                key={teacher.userId}
                onPress={() => setTarget(teacher.userId)}
                style={[styles.choice, selected && styles.choiceOn]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Body>{displayName(teacher)}</Body>
                <Caption>Teacher</Caption>
              </Pressable>
            );
          })}
          {!teachers.length ? (
            <Card>
              <Caption>No linked teachers yet. You can still send feedback to Hiraya Kids Learning Center.</Caption>
            </Card>
          ) : null}

          {error ? <Caption style={styles.error}>{error}</Caption> : null}
          <AppButton label={busy ? 'Sending…' : 'Send feedback'} onPress={() => void submit()} disabled={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.poppinsSemiBold,
    marginBottom: 8,
  },
  messageBox: {
    minHeight: 140,
    marginTop: 8,
    marginBottom: space.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? fonts.poppinsRegular : undefined,
    fontSize: 16,
    lineHeight: 22,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  choiceOn: {
    borderColor: colors.gold,
    backgroundColor: '#FFF8E8',
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: space.md,
  },
  starHit: {
    padding: 4,
  },
  star: {
    fontSize: 28,
    color: colors.muted,
  },
  starOn: {
    color: colors.gold,
  },
  error: {
    color: colors.danger,
    marginBottom: space.sm,
  },
});
