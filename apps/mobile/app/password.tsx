import { useState } from 'react';
import { api, useAuth } from '../src/auth';
import { AppButton, Body, Card, Field, Screen, Title } from '../src/components/ui';
import { friendlyError } from '../src/selectors';
import { colors } from '../src/theme';

export default function PasswordScreen() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setOk('');
    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!user) return;
    setBusy(true);
    try {
      await api.changePassword(user.userId, current, next);
      setOk('Password updated.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(friendlyError(err, 'Could not update password. Check the current password and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Change password</Title>
      <Card>
        {error ? <Body style={{ color: colors.danger, marginBottom: 8 }}>{error}</Body> : null}
        {ok ? <Body style={{ color: colors.success, marginBottom: 8 }}>{ok}</Body> : null}
        <Field label="Current password" secureTextEntry value={current} onChangeText={setCurrent} />
        <Field label="New password" secureTextEntry value={next} onChangeText={setNext} />
        <Field label="Confirm new password" secureTextEntry value={confirm} onChangeText={setConfirm} />
        <AppButton label="Save password" loading={busy} disabled={busy} onPress={() => void save()} />
      </Card>
    </Screen>
  );
}
