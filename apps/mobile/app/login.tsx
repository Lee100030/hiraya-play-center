import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, Body, Caption, Field, Kicker, Title } from '../src/components/ui';
import { isAdminLoginChallenge } from '@hiraya/api';
import { apiBaseUrl, consumeSessionNotice, useAuth } from '../src/auth';
import { friendlyError } from '../src/selectors';
import { colors, fonts, space } from '../src/theme';

function useLandingLayout() {
  // Capture size once. Live window metrics change with the keyboard and recast
  // this screen, which blurs the field and makes Android pop the IME.
  const [{ width, height }] = useState(() => Dimensions.get('window'));
  const compact = width < 380 || height < 640;
  const wide = width >= 720;
  const padX = Math.min(40, Math.max(16, width * 0.055));
  const logo = wide ? Math.min(200, width * 0.2) : Math.min(compact ? 84 : 128, width * 0.3);
  const titleSize = wide ? 36 : compact ? 24 : 28;
  const formWidth = wide ? Math.min(420, width * 0.44) : Math.min(460, width - padX * 2);
  return { width, compact, wide, padX, logo, titleSize, formWidth };
}

export default function LoginScreen() {
  const { login, completeAdminOtp, resendAdminOtp, user, ready } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frozenInsets = useRef({ top: insets.top, bottom: insets.bottom });
  if (insets.top > frozenInsets.current.top) frozenInsets.current.top = insets.top;
  if (insets.bottom > frozenInsets.current.bottom) frozenInsets.current.bottom = insets.bottom;
  const layout = useLandingLayout();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const notice = consumeSessionNotice();
    if (notice) setError(notice);
  }, []);

  if (ready && user) return <Redirect href="/(tabs)/home" />;

  async function onSubmit() {
    if (challenge) {
      if (!/^\d{6}$/.test(code.trim())) {
        setError('Enter the 6-digit code from the email.');
        return;
      }
      setError('');
      setBusy(true);
      try {
        await completeAdminOtp(challenge, code.trim(), remember);
        router.replace('/(tabs)/home');
      } catch (err) {
        setError(friendlyError(err, 'That sign-in code is not valid.', 'login'));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!identifier.trim() || !password) {
      setError('Enter your username or email and password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await login(identifier.trim(), password, remember);
      if (isAdminLoginChallenge(result)) {
        setChallenge(result.challenge);
        setSentTo(result.sentTo);
        setCode('');
        return;
      }
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(friendlyError(err, 'Could not sign in. Check your details and try again.', 'login'));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!challenge) return;
    setError('');
    setBusy(true);
    try {
      const next = await resendAdminOtp(challenge);
      setChallenge(next.challenge);
      setSentTo(next.sentTo);
      setCode('');
    } catch (err) {
      setError(friendlyError(err, 'The code could not be sent again.', 'login'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.greenDeep, colors.green, colors.greenMid, colors.green]}
        locations={[0, 0.38, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image source={require('../assets/hiraya-play-yard.jpg')} style={styles.campus} blurRadius={6} />
      <LinearGradient
        colors={['rgba(7, 20, 13, 0.35)', 'rgba(11, 31, 20, 0.72)', 'rgba(7, 20, 13, 0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.goldGlow} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.wrap,
          {
            paddingTop: Math.max(frozenInsets.current.top, 16) + 8,
            paddingBottom: Math.max(frozenInsets.current.bottom, 16) + 24,
            paddingHorizontal: layout.padX,
          },
          layout.wide && styles.wrapWide,
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets={false}
        automaticallyAdjustContentInsets={false}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, layout.wide && styles.heroWide, { maxWidth: layout.wide ? layout.width * 0.42 : layout.formWidth }]}>
          <Image
            source={require('../assets/hiraya-crest.png')}
            style={{ width: layout.logo, height: layout.logo, marginBottom: space.md }}
            accessibilityLabel="Hiraya Kids Learning Center"
          />
          <Kicker style={[styles.kicker, layout.wide && styles.alignStart]}>Hiraya Kids Learning Center</Kicker>
          <Title
            style={[
              styles.title,
              layout.wide && styles.alignStart,
              { fontSize: layout.titleSize, lineHeight: layout.titleSize + 8 },
            ]}
            maxFontSizeMultiplier={1.25}
          >
            Welcome to Hiraya Mobile
          </Title>
          <Caption style={[styles.trust, layout.wide && styles.alignStart]}>Small classes · Family partnership · Growing minds</Caption>
        </View>

        <View style={[styles.card, { width: layout.formWidth, maxWidth: '100%' }]}>
          {error && !challenge ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Body style={styles.errorText}>{error}</Body>
            </View>
          ) : null}

          <Field
            label="Email or username"
            required
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email or username"
            returnKeyType="next"
          />
          <Field
            label="Password"
            required
            secureTextEntry={hidden}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
            accessory={
              <Pressable
                onPress={() => setHidden((value) => !value)}
                style={styles.eye}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
              >
                <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.greenMid} />
              </Pressable>
            }
          />

          <Pressable
            onPress={() => setRemember((value) => !value)}
            style={styles.remember}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel="Stay signed in on this device"
          >
            <View style={[styles.check, remember && styles.checkOn]}>
              {remember ? <Ionicons name="checkmark" size={14} color={colors.gold} /> : null}
            </View>
            <Body style={styles.rememberLabel}>Stay signed in on this device</Body>
          </Pressable>

          <AppButton label="Sign in" onPress={() => void onSubmit()} loading={busy && !challenge} disabled={busy && !challenge} />

          <Pressable
            onPress={() =>
              Alert.alert(
                'Forgot password',
                'Ask the center to reset your password from the HIRAYA desktop or website. There is no self-service reset on this app yet.',
              )
            }
            style={styles.forgot}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
          >
            <Caption style={styles.forgotText}>Forgot password?</Caption>
          </Pressable>
        </View>

        <Modal visible={Boolean(challenge)} transparent animationType="fade" onRequestClose={() => { setChallenge(null); setCode(''); setError(''); }}>
          <View style={styles.otpBackdrop}>
            <View style={styles.otpCard}>
              <Image source={require('../assets/hiraya-crest.png')} style={styles.otpCrest} accessibilityIgnoresInvertColors />
              <Kicker style={styles.otpKicker}>Super Administrator</Kicker>
              <Title style={styles.otpTitle}>Enter your sign-in code</Title>
              <Body style={styles.otpCopy}>We sent a 6-digit code. It expires in 10 minutes.</Body>
              <Caption style={styles.otpMail}>{sentTo}</Caption>
              {error ? (
                <View style={styles.errorBox}>
                  <Body style={styles.errorText}>{error}</Body>
                </View>
              ) : null}
              <View style={styles.otpDigits}>
                {Array.from({ length: 6 }, (_, index) => (
                  <TextInput
                    key={index}
                    style={styles.otpDigit}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? 6 : 1}
                    value={code[index] || ''}
                    autoFocus={index === 0}
                    textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                    onChangeText={(value) => {
                      const chars = value.replace(/\D/g, '');
                      if (chars.length > 1) {
                        setCode((code.slice(0, index) + chars).replace(/\D/g, '').slice(0, 6));
                        return;
                      }
                      const slots = Array.from({ length: 6 }, (_, i) => code[i] || '');
                      slots[index] = chars.slice(-1);
                      setCode(slots.join('').replace(/\D/g, '').slice(0, 6));
                    }}
                  />
                ))}
              </View>
              <AppButton label={busy ? 'Checking…' : 'Confirm code'} onPress={() => void onSubmit()} loading={busy} disabled={busy} />
              <View style={styles.otpLinks}>
                <Pressable onPress={() => void onResend()} accessibilityRole="button">
                  <Caption style={styles.forgotText}>Resend code</Caption>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setChallenge(null);
                    setCode('');
                    setError('');
                  }}
                  accessibilityRole="button"
                >
                  <Caption style={styles.forgotText}>Cancel</Caption>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {__DEV__ ? (
          <Caption style={styles.devNote}>
            Dev · API {apiBaseUrl}{'\n'}Teachers / parents only · same Wi-Fi as this PC
          </Caption>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.greenDeep },
  campus: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: 0.22,
  },
  goldGlow: {
    position: 'absolute',
    top: '12%',
    left: '18%',
    right: '18%',
    height: 220,
    borderRadius: 200,
    backgroundColor: 'rgba(201, 162, 39, 0.22)',
  },
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 20,
  },
  wrapWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 28,
  },
  hero: {
    alignItems: 'center',
    width: '100%',
  },
  heroWide: {
    alignItems: 'flex-start',
  },
  kicker: {
    textAlign: 'center',
    color: '#D4AF37',
    letterSpacing: 2.4,
    marginBottom: 10,
  },
  title: {
    textAlign: 'center',
    color: colors.cream,
    fontFamily: fonts.playfairBold,
  },
  alignStart: {
    textAlign: 'left',
  },
  trust: {
    textAlign: 'center',
    color: 'rgba(244, 241, 233, 0.78)',
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.cream,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.38)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: space.md,
  },
  errorText: { color: colors.danger, textAlign: 'center' },
  eye: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space.lg,
    minHeight: 44,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  rememberLabel: {
    flex: 1,
  },
  forgot: {
    marginTop: space.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotText: {
    color: colors.green,
    textDecorationLine: 'underline',
    textDecorationColor: colors.gold,
  },
  otpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 20, 13, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  otpCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.cream,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: space.lg,
    alignItems: 'center',
  },
  otpCrest: {
    width: 72,
    height: 72,
    marginBottom: space.sm,
  },
  otpKicker: {
    color: colors.gold,
    letterSpacing: 1.4,
  },
  otpTitle: {
    color: colors.green,
    textAlign: 'center',
    marginTop: space.xs,
  },
  otpCopy: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  otpMail: {
    marginTop: space.sm,
    color: colors.green,
    backgroundColor: colors.goldSoft,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: '700',
  },
  otpDigits: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: space.lg,
  },
  otpDigit: {
    width: 44,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.green,
  },
  otpLinks: {
    width: '100%',
    marginTop: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  devNote: {
    width: '100%',
    textAlign: 'center',
    color: 'rgba(244, 241, 233, 0.45)',
    fontSize: 11,
  },
});
