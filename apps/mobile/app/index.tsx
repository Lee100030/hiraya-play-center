import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isFamilyRole } from '@hiraya/utils';
import { useAuth } from '../src/auth';

export default function LoginScreen() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (ready && user) {
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>HIRAYA</Text>
      <Text style={styles.sub}>Family and teacher sign-in</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput style={styles.input} placeholder="Username or email" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable
        style={styles.btn}
        onPress={async () => {
          setError('');
          try {
            const next = await login(identifier, password);
            if (next.role === 'staff') {
              setError('Staff work on the desktop or website, not the phone app.');
              return;
            }
            router.replace('/(tabs)');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
          }
        }}
      >
        <Text style={styles.btnText}>Continue</Text>
      </Pressable>
      <Text style={styles.hint}>
        {isFamilyRole(user?.role) ? 'Family workspace' : 'Use your HIRAYA account'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F7F1E1', padding: 24, justifyContent: 'center' },
  title: { fontSize: 40, color: '#0B3D2E', fontWeight: '700' },
  sub: { marginBottom: 24, color: '#5d6b64' },
  input: {
    backgroundColor: '#fffef8',
    borderColor: '#d9c98a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  btn: { backgroundColor: '#D4AF37', borderRadius: 999, padding: 14, alignItems: 'center' },
  btnText: { color: '#041009', fontWeight: '700' },
  error: { color: '#c44536', marginBottom: 8 },
  hint: { marginTop: 16, color: '#5d6b64' },
});
