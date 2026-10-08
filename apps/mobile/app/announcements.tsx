import { useState } from 'react';
import { Pressable } from 'react-native';
import { formatDate } from '@hiraya/utils';
import type { NewsItem } from '@hiraya/types';
import { Body, Caption, Card, EmptyState, ErrorState, Heading, LoadingState, Screen, Title } from '../src/components/ui';
import { ReadModal } from '../src/components/ReadModal';
import { useCenter } from '../src/store';
import { adminAnnouncements } from '../src/selectors';
import { colors } from '../src/theme';

export default function AnnouncementsScreen() {
  const { store, loading, error, refresh } = useCenter();
  const [open, setOpen] = useState<NewsItem | null>(null);
  const rows = adminAnnouncements(store);

  if (loading && !rows.length) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <Title>Announcements</Title>
        {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : null}
        {rows.length === 0 ? (
          <EmptyState icon="megaphone-outline" title="No announcements" hint="Center news will show up here when published." />
        ) : (
          rows.map((item) => (
            <Pressable
              key={item.newsId}
              onPress={() => setOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={`Read announcement ${item.title}`}
            >
              <Card>
                <Caption>{formatDate(item.publishedAt)}</Caption>
                <Heading>{item.title}</Heading>
                <Body numberOfLines={3}>{item.body}</Body>
                <Caption style={{ marginTop: 8, color: colors.green }}>Tap to read</Caption>
              </Card>
            </Pressable>
          ))
        )}
      </Screen>
      <ReadModal
        visible={Boolean(open)}
        title={open?.title}
        date={open?.publishedAt}
        body={open?.body}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
