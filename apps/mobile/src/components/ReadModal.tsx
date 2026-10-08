import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '@hiraya/utils';
import { colors, fonts, radius, space } from '../theme';
import { AppButton } from './ui';
import { Body, Caption, Heading } from './typography';

export function ReadModal({
  visible,
  kicker = 'Announcement',
  title,
  date,
  body,
  onClose,
}: {
  visible: boolean;
  kicker?: string;
  title?: string;
  date?: string;
  body?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const when = date ? formatDate(date) : '';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Caption style={styles.kicker}>{kicker}</Caption>
          <Heading style={styles.title}>{title || 'Announcement'}</Heading>
          {when ? <Caption style={styles.when}>{when}</Caption> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            bounces
          >
            <Body selectable style={styles.body}>
              {(body || '').trim() || 'No message was written for this announcement.'}
            </Body>
          </ScrollView>
          <AppButton label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  sheet: {
    zIndex: 1,
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.28)',
    padding: 20,
    gap: 6,
  },
  kicker: {
    color: colors.gold,
    fontFamily: fonts.poppinsSemiBold,
  },
  title: {
    color: colors.green,
  },
  when: {
    marginBottom: 4,
  },
  scroll: {
    maxHeight: 360,
    marginVertical: 8,
  },
  scrollInner: {
    paddingBottom: 8,
  },
  body: {
    color: colors.text,
  },
});
