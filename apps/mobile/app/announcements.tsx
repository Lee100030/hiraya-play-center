import { useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { formatDate } from '@hiraya/utils';
import { Body, Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, Title } from '../src/components/ui';
import { useCenter } from '../src/store';
import { colors } from '../src/theme';
import type { NewsItem } from '@hiraya/types';

export default function AnnouncementsScreen() {
  const { store, loading, error, refresh } = useCenter();
  const [open, setOpen] = useState<NewsItem | null>(null);
  const rows = store.news.filter((item) => item.isPublished || item.status === 'published' || !item.status);

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Announcements</Title>
      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
      {rows.length === 0 ? (
        <EmptyState icon="megaphone-outline" title="No announcements" hint="Center news will show up here when published." />
      ) : (
        rows.map((item) => (
          <Pressable key={item.newsId} onPress={() => setOpen(item)}>
            <Card>
              <Caption>{formatDate(item.publishedAt)}</Caption>
              <Heading>{item.title}</Heading>
              <Body numberOfLines={3}>
                {item.body}
              </Body>
            </Card>
          </Pressable>
        ))
      )}
      <Modal visible={Boolean(open)} animationType="slide" transparent onRequestClose={() => setOpen(null)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => setOpen(null)}>
          <Pressable
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}
            onPress={(event) => event.stopPropagation()}
          >
            <Heading>{open?.title}</Heading>
            <Caption>{formatDate(open?.publishedAt)}</Caption>
            <Body style={{ marginTop: 12 }}>{open?.body}</Body>
            <Pressable onPress={() => setOpen(null)} style={{ minHeight: 44, marginTop: 16 }}>
              <Body style={{ color: colors.green }}>Close</Body>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
