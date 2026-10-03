import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth';
import { useCenter } from '../../src/store';
import { isMobileParent, isMobileTeacher } from '../../src/rbac';
import { colors, fonts } from '../../src/theme';
import { FloatingMessageButton } from '../../src/components/FloatingMessageButton';
import { FloatingFeedbackButton } from '../../src/components/FloatingFeedbackButton';

export const unstable_settings = {
  initialRouteName: 'home',
};

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const { store } = useCenter();
  const insets = useSafeAreaInsets();
  const unread = store.alerts.filter((item) => !item.read && item.kind !== 'direct').length;
  const teacher = isMobileTeacher(user?.role);
  const parent = isMobileParent(user?.role);
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          title: 'Home',
          headerShown: false,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: '#E8E2D4',
          tabBarStyle: {
            backgroundColor: colors.greenDeep,
            borderTopColor: '#123226',
            height: 58 + Math.max(insets.bottom, 10),
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 8,
          },
          tabBarItemStyle: { paddingHorizontal: 0 },
          tabBarLabelStyle: {
            fontFamily: fonts.poppinsSemiBold,
            fontSize: 10,
            letterSpacing: 0,
          },
          tabBarAllowFontScaling: false,
        }}
      >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: teacher ? 'Calendar' : 'Schedule',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: teacher ? 'Modules' : 'Progress',
          href: teacher || parent ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={teacher ? 'book-outline' : 'trending-up-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: teacher ? 'News' : 'Alerts',
          tabBarBadge: unread || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.white, fontSize: 10, fontFamily: fonts.poppinsSemiBold },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={teacher ? 'megaphone-outline' : 'notifications-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
      </Tabs>
      <FloatingMessageButton />
      <FloatingFeedbackButton />
    </View>
  );
}
