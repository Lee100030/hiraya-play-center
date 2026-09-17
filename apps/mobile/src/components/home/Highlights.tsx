import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NewsItem } from '@hiraya/types';
import { Heading } from '../typography';
import { colors, space } from '../../theme';
import { PressScale } from './motion';

const CAMPUS: ImageSourcePropType[] = [
  require('../../../assets/hiraya-play-yard.jpg'),
  require('../../../assets/hiraya-preschool.jpg'),
  require('../../../assets/hiraya-class-session.jpg'),
  require('../../../assets/hiraya-tree-court.jpg'),
];

type Slide = {
  id: string;
  title: string;
  image: ImageSourcePropType;
};

export function HomeHighlights({
  news,
  onOpen,
}: {
  news: NewsItem[];
  onOpen: () => void;
}) {
  const { width } = useWindowDimensions();
  const gutter = space.lg * 2;
  const cardWidth = Math.max(280, width - gutter);
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Slide>>(null);

  const slides = useMemo<Slide[]>(() => {
    const published = news.filter((item) => item.isPublished || item.status === 'published' || !item.status);
    if (published.length) {
      return published.slice(0, 5).map((item, i) => ({
        id: item.newsId,
        title: item.title,
        image: CAMPUS[i % CAMPUS.length],
      }));
    }
    return [
      { id: 'campus-yard', title: 'Indoor play yard at HIRAYA', image: CAMPUS[0] },
      { id: 'campus-preschool', title: 'Welcome to preschool', image: CAMPUS[1] },
      { id: 'campus-class', title: 'Learning together, every day', image: CAMPUS[2] },
      { id: 'campus-tree', title: 'The Hiraya Tree court', image: CAMPUS[3] },
    ];
  }, [news]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12));
    if (next !== index && next >= 0 && next < slides.length) setIndex(next);
  }

  return (
    <View>
      <FlatList
        ref={list}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled={false}
        snapToInterval={cardWidth + 12}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <PressScale onPress={onOpen} style={{ width: cardWidth }} accessibilityLabel={item.title}>
            <View style={styles.card}>
              <Image source={item.image} style={styles.image} />
              <LinearGradient
                colors={['rgba(7, 20, 13, 0.15)', 'rgba(11, 31, 20, 0.55)', 'rgba(7, 20, 13, 0.92)']}
                locations={[0, 0.42, 1]}
                style={styles.overlay}
              />
              <Heading style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {item.title}
              </Heading>
            </View>
          </PressScale>
        )}
      />
      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityRole="tablist">
          {slides.map((item, i) => (
            <View key={item.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 176,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.green,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  title: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    color: colors.cream,
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotOn: {
    width: 18,
    backgroundColor: colors.gold,
  },
});
