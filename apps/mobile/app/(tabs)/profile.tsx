import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { displayName, roleLabel } from '@hiraya/utils';
import { AppButton, Body, Caption, Card, EmptyValue, Field, RowLink, Screen, SectionTitle } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { Title } from '../../src/components/typography';
import { api, useAuth } from '../../src/auth';
import { useCenter } from '../../src/store';
import { askProfilePhotoSource, pickProfilePhoto } from '../../src/pickPhoto';
import { uploadProfilePhotoNative } from '../../src/uploadPhoto';
import { useSessionProfile } from '../../src/profilePhoto';
import { givenName } from '../../src/selectors';
import { colors } from '../../src/theme';

export default function ProfileTab() {
  const { user, logout, refreshUser } = useAuth();
  const { store, refresh } = useCenter();
  const profile = useSessionProfile();
  const router = useRouter();
  const settings = store.settings;
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');

  useEffect(() => {
    setPhone(profile?.phone || '');
    setAddress(profile?.address || '');
  }, [profile?.phone, profile?.address]);

  async function applyPhoto(source: 'library' | 'camera') {
    if (!user?.userId) return;
    const picked = await pickProfilePhoto(source);
    if (!picked) return;
    setBusy(true);
    setMessage('');
    try {
      await uploadProfilePhotoNative(user.userId, picked.uri, picked.name);
      await refreshUser();
      await refresh();
    } catch (err) {
      Alert.alert('Photo not saved', err instanceof Error ? err.message : 'Try again with a smaller JPG or PNG.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => void applyPhoto(source) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!user?.userId) return;
    setBusy(true);
    try {
      await api.removeProfilePhoto(user.userId);
      await refreshUser();
      await refresh();
    } catch (err) {
      Alert.alert('Could not remove photo', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveFamily() {
    if (!user) return;
    setBusy(true);
    setMessage('');
    try {
      await api.saveProfile({
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username || undefined,
        email: user.email,
        phone,
        address,
        position: user.position,
      });
      await refreshUser();
      await refresh();
      setMessage('Family contact saved.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Sign in again and retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar
          user={profile}
          size="lg"
          editable
          accessibilityLabel="Your profile photo. Tap to change."
          onPress={() =>
            askProfilePhotoSource(
              (source) => void applyPhoto(source),
              profile?.profileImagePath ? () => void removePhoto() : undefined,
            )
          }
        />
        <Title style={{ marginTop: 14 }}>{givenName(profile) || displayName(profile)}</Title>
        <Caption>{roleLabel(profile?.role)}</Caption>
        <Caption style={{ marginTop: 6, color: colors.gold }}>
          {busy ? 'Saving photo…' : profile?.profileImagePath ? 'Tap the photo to update it' : 'Add a photo so families recognize you'}
        </Caption>
        {message ? <Caption style={{ marginTop: 6 }}>{message}</Caption> : null}
      </View>
      <Card>
        <Caption>Email</Caption>
        {profile?.email ? <Body>{profile.email}</Body> : <EmptyValue />}
        <View style={{ height: 12 }} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Address" value={address} onChangeText={setAddress} />
        <AppButton label="Save family contact" onPress={() => void saveFamily()} loading={busy} disabled={busy} />
        {message ? <Caption style={{ marginTop: 8 }}>{message}</Caption> : null}
      </Card>
      <SectionTitle title="Account" />
      <Card>
        <RowLink icon="lock-closed-outline" label="Change password" hint="Update the password for this device." onPress={() => router.push('/password')} />
        <RowLink
          icon="chatbubble-ellipses-outline"
          label="Messages"
          hint={
            store.alerts.some((item) => item.kind === 'direct' && !item.read && item.status !== 'sent')
              ? 'You have a reply waiting.'
              : 'Message admin, teachers, co-parents, or your groups.'
          }
          onPress={() => router.push('/messages')}
        />
        <RowLink
          icon="heart-outline"
          label="Send feedback"
          hint="Rate a teacher or Hiraya Kids Learning Center."
          onPress={() => router.push('/feedback')}
        />
        <RowLink
          icon="notifications-outline"
          label="Notification settings"
          hint={
            profile?.notifyAttendance
              ? 'Attendance, payments, schedule, and progress alerts follow your account flags.'
              : 'Managed by the center for this account.'
          }
          onPress={() =>
            Alert.alert(
              'Notification settings',
              'Attendance, payment, schedule, and progress email flags are stored on your account. Ask the center if you need them changed.',
            )
          }
        />
        <RowLink
          icon="shield-checkmark-outline"
          label="Privacy"
          hint="Your session is stored securely on this device."
          onPress={() =>
            Alert.alert('Privacy', 'Sign-in tokens are stored in the device secure store. Family records are limited to your children.')
          }
        />
      </Card>
      <SectionTitle title="Help" />
      <Card>
        <RowLink
          icon="call-outline"
          label="Contact the center"
          hint={[settings.phone, settings.email].filter(Boolean).join(' · ') || 'Use the public website contact page.'}
          onPress={() =>
            Alert.alert(
              settings.centerName || 'Hiraya Kids Learning Center',
              `${settings.address || ''}\n${settings.phone || ''}\n${settings.email || ''}`.trim(),
            )
          }
        />
      </Card>
      <AppButton
        label={signingOut ? 'Signing out…' : 'Log out'}
        variant="danger"
        loading={signingOut}
        disabled={busy || signingOut}
        onPress={() => {
          Alert.alert('Log out', 'Sign out of this device?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Log out',
              style: 'destructive',
              onPress: () => {
                setSigningOut(true);
                void logout()
                  .catch(() => undefined)
                  .finally(() => {
                    router.replace('/login');
                    setSigningOut(false);
                  });
              },
            },
          ]);
        }}
      />
    </Screen>
  );
}
