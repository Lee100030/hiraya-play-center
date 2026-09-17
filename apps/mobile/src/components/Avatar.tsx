import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { displayName } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import { Title } from './typography';
import { profilePhotoUri } from '../profilePhoto';
import { colors, fonts } from '../theme';

type Size = 'sm' | 'md' | 'lg' | 'hero';

const SIZES: Record<Size, number> = { sm: 40, md: 52, lg: 104, hero: 84 };

export function Avatar({
  user,
  name,
  uri,
  size = 'md',
  onPress,
  editable = false,
  accessibilityLabel,
  ring = true,
}: {
  user?: HirayaUser | null;
  name?: string;
  uri?: string;
  size?: Size;
  onPress?: () => void;
  editable?: boolean;
  accessibilityLabel?: string;
  ring?: boolean;
}) {
  const px = SIZES[size];
  const photo = uri || profilePhotoUri(user);
  const label = name || displayName(user) || 'Profile';
  const initial = label.trim().slice(0, 1).toUpperCase() || '?';
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(photo));

  useEffect(() => {
    setFailed(false);
    setLoading(Boolean(photo));
  }, [photo]);
  const showPhoto = Boolean(photo) && !failed;

  const inner = (
    <View style={{ width: px, height: px }}>
      <View
        style={[
          styles.circle,
          {
            width: px,
            height: px,
            borderRadius: px / 2,
            borderWidth: ring ? (size === 'lg' ? 2 : 1.5) : 0,
          },
        ]}
      >
        {showPhoto ? (
          <Image
            source={{ uri: photo }}
            style={{ width: px, height: px }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
          />
        ) : (
          <Title
            style={[styles.initial, { fontSize: Math.round(px * 0.42), lineHeight: Math.round(px * 0.5) }]}
            maxFontSizeMultiplier={1.1}
          >
            {initial}
          </Title>
        )}
        {showPhoto && loading ? (
          <View style={[styles.skel, { borderRadius: px / 2 }]}>
            <ActivityIndicator color={colors.gold} size="small" />
          </View>
        ) : null}
      </View>
      {editable ? (
        <View style={styles.edit} accessibilityElementsHidden>
          <Ionicons name="pencil" size={size === 'lg' ? 12 : 10} color={colors.greenDeep} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${label} profile photo`}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.greenMid,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: colors.cream,
    fontFamily: fonts.playfairBold,
  },
  skel: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 31, 20, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  edit: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cream,
  },
});
