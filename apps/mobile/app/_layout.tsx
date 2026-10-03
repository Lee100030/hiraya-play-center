import 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { Body, Caption, Heading } from '../src/components/typography';
import { StoreProvider } from '../src/store';
import { colors, fontAssets, fonts, space } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be hidden in Expo Go.
});

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <Heading style={styles.errorTitle}>HIRAYA could not start</Heading>
      <ScrollView style={{ maxHeight: 320 }}>
        <Body style={styles.errorBody}>{error?.message || 'Unknown error'}</Body>
        {error?.stack ? <Caption>{error.stack}</Caption> : null}
      </ScrollView>
      <Pressable onPress={retry} style={styles.retry}>
        <Body style={styles.retryText}>Try again</Body>
      </Pressable>
    </View>
  );
}

function stackScreen(title: string) {
  return {
    title,
    headerBackTitle: 'Back',
    headerBackTitleVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontError) {
      console.warn('HIRAYA fonts failed to load; falling back to system typefaces.', fontError);
    }
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StoreProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.green },
                headerTintColor: colors.cream,
                headerTitleStyle: { fontFamily: fonts.playfairBold, fontSize: 18, color: colors.cream },
                headerBackTitle: 'Back',
                headerBackTitleVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.cream },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home', headerBackTitle: 'Home' }} />
              <Stack.Screen name="student/[id]" options={stackScreen('Student')} />
              <Stack.Screen name="programs" options={stackScreen('Programs')} />
              <Stack.Screen name="program/[id]" options={stackScreen('Program')} />
              <Stack.Screen name="enroll" options={stackScreen('Enrollment')} />
              <Stack.Screen name="attendance" options={stackScreen('Attendance')} />
              <Stack.Screen name="payments" options={stackScreen('Payments')} />
              <Stack.Screen name="modules" options={stackScreen('Learning modules')} />
              <Stack.Screen name="announcements" options={stackScreen('Announcements')} />
              <Stack.Screen name="tasks" options={stackScreen('My tasks')} />
              <Stack.Screen name="sessions" options={stackScreen('Sessions')} />
              <Stack.Screen name="students" options={stackScreen('My students')} />
              <Stack.Screen name="notes" options={stackScreen('Notes')} />
              <Stack.Screen name="salary" options={stackScreen('My salary')} />
              <Stack.Screen name="feedback" options={stackScreen('Feedback')} />
              <Stack.Screen name="password" options={stackScreen('Password')} />
              <Stack.Screen
                name="messages"
                options={{
                  ...stackScreen('Message the center'),
                  presentation: 'modal',
                }}
              />
            </Stack>
          </StoreProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorWrap: { flex: 1, backgroundColor: colors.cream, padding: space.lg, justifyContent: 'center' },
  errorTitle: { marginBottom: space.sm },
  errorBody: { color: colors.danger, marginBottom: space.sm },
  retry: {
    marginTop: space.lg,
    backgroundColor: colors.green,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  retryText: { color: colors.cream, fontFamily: fonts.poppinsBold },
});
