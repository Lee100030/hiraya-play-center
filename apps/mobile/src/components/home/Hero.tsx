import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayName } from '@hiraya/utils';
import type { HirayaUser, Student } from '@hiraya/types';
import { Body, Caption, Kicker, Title } from '../typography';
import { Avatar } from '../Avatar';
import { greetingPeriod, givenName, studentLabel } from '../../selectors';
import { colors, fonts, radius, space } from '../../theme';

type Props = {
  user: HirayaUser | null;
  family: boolean;
  childrenList: Student[];
  selected?: Student;
  onOpenProfile: () => void;
  onSelectChild: (id: string) => void;
  unreadCount?: number;
  onOpenAlerts?: () => void;
};

function useStatusTopPad() {
  const insets = useSafeAreaInsets();
  const expoBar = Constants.statusBarHeight ?? 0;
  const floor = Platform.OS === 'ios' ? 50 : 36;
  return Math.max(insets.top, expoBar, floor) + 18;
}

export function HomeHero({ user, family, childrenList, selected, onOpenProfile, onSelectChild, unreadCount = 0, onOpenAlerts }: Props) {
  const topPad = useStatusTopPad();
  const name = givenName(user);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[colors.greenDeep, colors.green, colors.greenMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('../../../assets/hiraya-crest.png')}
        style={styles.watermark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={[styles.inner, { paddingTop: topPad }]}>
        <View style={styles.topRow}>
          <View style={styles.copy}>
            <Kicker style={styles.kicker}>{greetingPeriod()}</Kicker>
            <Title style={styles.title} maxFontSizeMultiplier={1.2}>
              Welcome back,{'\n'}
              {name}
            </Title>
            <Caption style={styles.role} maxFontSizeMultiplier={1.2}>
              {family ? (selected ? studentLabel(selected) : 'Family companion') : 'Teacher companion'}
            </Caption>
          </View>
          <View style={styles.avatarCol}>
            {onOpenAlerts ? (
              <Pressable
                onPress={onOpenAlerts}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                style={styles.bell}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.gold} />
                {unreadCount > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            <Avatar
              user={family ? undefined : user}
              name={family ? (selected ? studentLabel(selected) : name) : name}
              size="hero"
              accessibilityLabel={`${family ? studentLabel(selected) || name : displayName(user) || name} profile photo. Open profile.`}
              onPress={onOpenProfile}
              editable={!family && !user?.profileImagePath}
            />
            {!family && !user?.profileImagePath ? (
              <Caption style={styles.addPhoto}>Add photo</Caption>
            ) : null}
          </View>
        </View>
        {family && childrenList.length > 1 ? (
          <View style={styles.chips} accessibilityRole="tablist">
            {childrenList.map((item) => {
              const active = selected?.studentId === item.studentId;
              return (
                <Pressable
                  key={item.studentId}
                  onPress={() => onSelectChild(item.studentId)}
                  style={[styles.chip, active && styles.chipOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={studentLabel(item)}
                >
                  <Body style={[styles.chipText, active && styles.chipTextOn]} numberOfLines={1}>
                    {studentLabel(item)}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.greenDeep,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  inner: {
    paddingLeft: space.lg,
    paddingRight: space.lg,
    paddingBottom: 32,
    zIndex: 1,
  },
  watermark: {
    position: 'absolute',
    right: -20,
    bottom: -28,
    width: 150,
    height: 150,
    opacity: 0.1,
    zIndex: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarCol: {
    alignItems: 'center',
    gap: 6,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginBottom: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 99,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  addPhoto: {
    color: colors.gold,
    fontSize: 11,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: colors.gold,
    marginBottom: 8,
  },
  title: {
    color: colors.cream,
    fontSize: 26,
    lineHeight: 36,
  },
  role: {
    color: 'rgba(244, 241, 233, 0.78)',
    marginTop: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.md,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.45)',
    paddingHorizontal: 12,
    minHeight: 34,
    justifyContent: 'center',
    maxWidth: '48%',
  },
  chipOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    color: colors.cream,
    fontSize: 13,
    lineHeight: 18,
  },
  chipTextOn: {
    color: colors.greenDeep,
    fontFamily: fonts.poppinsSemiBold,
  },
});
