import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { api, useAuth } from '../src/auth';
import { AppButton, Body, Caption, Card, EmptyState, Field, Label, Screen, StatusBadge, Title, Heading } from '../src/components/ui';
import { canEnrollChild } from '../src/rbac';
import { useCenter } from '../src/store';
import { displayName } from '@hiraya/utils';
import { friendlyError, todayKey } from '../src/selectors';
import { colors } from '../src/theme';

const STEPS = ['Student', 'Parent', 'Program', 'Review'];

export default function EnrollScreen() {
  const { program: prefill } = useLocalSearchParams<{ program?: string }>();
  const { user } = useAuth();
  const { store } = useCenter();
  const programs = store.programs.filter((item) => item.status === 'active');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [form, setForm] = useState({
    studentFullname: '',
    studentBirthdate: '',
    studentGender: '',
    parentFullname: displayName(user),
    parentEmail: user?.email || '',
    parentPhone: user?.phone || '',
    preferredProgram: typeof prefill === 'string' ? prefill : programs[0]?.name || '',
    preferredSchedule: '',
    notes: '',
  });

  if (!canEnrollChild(user)) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Enrollment is for parents"
          hint="Teachers cannot submit family enrollment from this app. Parents enroll their own children here."
        />
      </Screen>
    );
  }

  const patch = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const canNext = useMemo(() => {
    if (step === 0) return form.studentFullname.trim().length > 1 && Boolean(form.studentBirthdate);
    if (step === 1) return form.parentFullname.trim().length > 1 && form.parentEmail.includes('@') && form.parentPhone.replace(/\D/g, '').length >= 7;
    if (step === 2) return Boolean(form.preferredProgram);
    return true;
  }, [form, step]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const result = await api.applyEnrollment({
        studentFullname: form.studentFullname,
        studentBirthdate: form.studentBirthdate,
        studentAge: 0,
        studentGender: form.studentGender,
        parentFullname: form.parentFullname,
        parentEmail: form.parentEmail,
        parentPhone: form.parentPhone,
        preferredProgram: form.preferredProgram,
        preferredSchedule: form.preferredSchedule,
        notes: form.notes,
      });
      setApplicationId(result.applicationId || '');
      setDone(true);
    } catch (err) {
      setError(friendlyError(err, 'We could not submit this enrollment. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Card>
          <StatusBadge status="pending" />
          <Title style={{ marginTop: 8 }}>Enrollment submitted</Title>
          <Body>The center will review this application. After approval, the child appears in your family workspace.</Body>
          <Line label="Student" value={form.studentFullname} />
          <Line label="Program" value={form.preferredProgram} />
          <Line label="Submitted" value={todayKey()} />
          <Line label="Status" value="Pending review" />
          {applicationId ? <Line label="Reference" value={applicationId} /> : null}
          <Caption style={{ marginTop: 12 }}>
            Keep this reference number for follow-up with the learning center.
          </Caption>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Enroll</Title>
      <View style={{ flexDirection: 'row', marginVertical: 12 }}>
        {STEPS.map((label, index) => (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: index <= step ? colors.green : colors.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heading style={{ color: index <= step ? colors.cream : colors.muted, fontSize: 14, lineHeight: 18 }}>{index + 1}</Heading>
            </View>
            <Caption>{label}</Caption>
          </View>
        ))}
      </View>
      {error ? <Body style={{ color: colors.danger, marginBottom: 8 }}>{error}</Body> : null}

      {step === 0 ? (
        <Card>
          <Field label="Child full name" required value={form.studentFullname} onChangeText={(value) => patch('studentFullname', value)} />
          <Field label="Birthdate" required placeholder="YYYY-MM-DD" value={form.studentBirthdate} onChangeText={(value) => patch('studentBirthdate', value)} />
          <Field label="Gender" placeholder="female / male" autoCapitalize="none" value={form.studentGender} onChangeText={(value) => patch('studentGender', value)} />
        </Card>
      ) : null}
      {step === 1 ? (
        <Card>
          <Field label="Parent / guardian" required value={form.parentFullname} onChangeText={(value) => patch('parentFullname', value)} />
          <Field label="Email" required keyboardType="email-address" autoCapitalize="none" value={form.parentEmail} onChangeText={(value) => patch('parentEmail', value)} />
          <Field label="Phone" required keyboardType="phone-pad" value={form.parentPhone} onChangeText={(value) => patch('parentPhone', value)} />
        </Card>
      ) : null}
      {step === 2 ? (
        <Card>
          <Label>Program *</Label>
          {programs.length === 0 ? (
            <Field label="Program name" required value={form.preferredProgram} onChangeText={(value) => patch('preferredProgram', value)} />
          ) : (
            programs.map((item) => (
              <View key={item.programId} style={{ marginBottom: 8 }}>
                <AppButton
                  label={item.name}
                  variant={form.preferredProgram === item.name ? 'primary' : 'ghost'}
                  onPress={() => patch('preferredProgram', item.name)}
                />
              </View>
            ))
          )}
          <View style={{ height: 8 }} />
          <Field label="Preferred schedule" placeholder="Morning / afternoon" value={form.preferredSchedule} onChangeText={(value) => patch('preferredSchedule', value)} />
        </Card>
      ) : null}
      {step === 3 ? (
        <Card>
          <Line label="Student" value={form.studentFullname} />
          <Line label="Birthdate" value={form.studentBirthdate} />
          <Line label="Parent" value={form.parentFullname} />
          <Line label="Contact" value={`${form.parentEmail} · ${form.parentPhone}`} />
          <Line label="Program" value={form.preferredProgram} />
          <Field label="Notes" value={form.notes} onChangeText={(value) => patch('notes', value)} />
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {step > 0 ? (
          <View style={{ flex: 1 }}>
            <AppButton label="Back" variant="ghost" onPress={() => setStep((value) => value - 1)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {step < 3 ? (
            <AppButton label="Next" disabled={!canNext} onPress={() => setStep((value) => value + 1)} />
          ) : (
            <AppButton label="Submit" loading={busy} disabled={busy} onPress={() => void submit()} />
          )}
        </View>
      </View>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Caption>{label}</Caption>
      <Body>{value}</Body>
    </View>
  );
}
