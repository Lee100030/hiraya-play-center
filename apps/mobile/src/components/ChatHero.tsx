import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

const USER_LINE = "Can I message my child's teacher?";
const REPLY_WORDS = ['Yes.', 'Pick', 'their', 'name', 'and', 'send', 'a', 'short', 'note.'];
const CHAR_MS = 48;
const WORD_MS = 150;
const DOTS_MS = 900;
const HOLD_MS = 2500;
const FADE_MS = 400;

function Dot({ delay, active }: { delay: number; active: boolean }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -4, duration: 180, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(540),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, delay, y]);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.greenMid,
        transform: [{ translateY: y }],
      }}
    />
  );
}

export function ChatHero() {
  const rootRef = useRef<View>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const running = useRef(false);
  const pop = useRef(new Animated.Value(0)).current;
  const threadOpacity = useRef(new Animated.Value(1)).current;
  const [reduced, setReduced] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [assistant, setAssistant] = useState<'hidden' | 'dots' | 'stream'>('hidden');
  const [wordCount, setWordCount] = useState(0);
  const [caret, setCaret] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const clearTimers = () => {
      for (const id of timers.current) clearTimeout(id);
      timers.current = [];
    };
    const onScreen = () =>
      new Promise<boolean>((resolve) => {
        const node = rootRef.current;
        if (!node) {
          resolve(false);
          return;
        }
        node.measureInWindow((_x, y, width, height) => {
          const windowHeight = Dimensions.get('window').height;
          resolve(width > 0 && height > 0 && y < windowHeight && y + height > 0);
        });
      });

    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.current = timers.current.filter((item) => item !== id);
        if (!running.current || cancelled) return;
        void onScreen().then((visible) => {
          if (!running.current || cancelled) return;
          if (!visible) {
            running.current = false;
            return;
          }
          fn();
        });
      }, ms);
      timers.current.push(id);
    };

    const finish = () => {
      running.current = false;
      clearTimers();
      pop.setValue(1);
      threadOpacity.setValue(1);
      setUserCount(USER_LINE.length);
      setAssistant('stream');
      setWordCount(REPLY_WORDS.length);
      setCaret(false);
    };

    const play = () => {
      if (!running.current) return;
      threadOpacity.setValue(1);
      pop.setValue(0);
      setUserCount(0);
      setAssistant('hidden');
      setWordCount(0);
      setCaret(false);
      later(() => {
        Animated.timing(pop, {
          toValue: 1,
          duration: 600,
          easing: Easing.bezier(0.22, 1.4, 0.36, 1),
          useNativeDriver: true,
        }).start();
        const typeNext = (index: number) => {
          setUserCount(index);
          if (index < USER_LINE.length) {
            later(() => typeNext(index + 1), CHAR_MS);
            return;
          }
          setAssistant('dots');
          later(() => {
            setAssistant('stream');
            setCaret(true);
            const wordNext = (count: number) => {
              setWordCount(count);
              if (count < REPLY_WORDS.length) {
                later(() => wordNext(count + 1), WORD_MS);
                return;
              }
              setCaret(false);
              later(() => {
                Animated.timing(threadOpacity, {
                  toValue: 0,
                  duration: FADE_MS,
                  useNativeDriver: true,
                }).start();
                later(play, FADE_MS);
              }, HOLD_MS);
            };
            wordNext(1);
          }, DOTS_MS);
        };
        typeNext(1);
      }, 32);
    };

    const start = () => {
      if (cancelled || running.current) return;
      running.current = true;
      play();
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (cancelled) return;
      if (enabled) {
        setReduced(true);
        finish();
        return;
      }
      start();
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (enabled) {
        setReduced(true);
        finish();
      } else {
        setReduced(false);
        start();
      }
    });

    return () => {
      cancelled = true;
      running.current = false;
      clearTimers();
      sub.remove();
    };
  }, [pop, threadOpacity]);

  const reply = REPLY_WORDS.slice(0, wordCount).join(' ');

  return (
    <View ref={rootRef} accessibilityLabel="Message the center">
      <Text style={{ color: colors.green, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Message the center</Text>
      <Animated.View
        style={{ opacity: threadOpacity, gap: 12, minHeight: 148 }}
        role="log"
        accessibilityLiveRegion="none"
      >
        <View style={{ alignItems: 'flex-end' }}>
          <Animated.View
            style={{
              maxWidth: '86%',
              opacity: reduced ? 1 : pop,
              transform: reduced
                ? undefined
                : [
                    { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                    { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                  ],
              transformOrigin: 'right bottom',
            }}
          >
            <LinearGradient
              colors={['#e0c15a', '#c9a227', '#8d6e16']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                borderBottomRightRadius: 4,
              }}
            >
              <Text style={{ color: '#fff', lineHeight: 20 }}>{userCount > 0 ? USER_LINE.slice(0, userCount) : ' '}</Text>
            </LinearGradient>
          </Animated.View>
        </View>
        {assistant !== 'hidden' ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.greenMid,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#f4e7c3', fontSize: 14 }}>✦</Text>
            </View>
            <View
              style={{
                maxWidth: '86%',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                borderBottomLeftRadius: 4,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: 'rgba(20, 48, 31, 0.16)',
              }}
            >
              {assistant === 'dots' ? (
                <View style={{ flexDirection: 'row', gap: 4, height: 18, alignItems: 'center' }}>
                  <Dot delay={0} active={!reduced} />
                  <Dot delay={150} active={!reduced} />
                  <Dot delay={300} active={!reduced} />
                </View>
              ) : (
                <Text style={{ color: colors.greenMid, lineHeight: 20 }}>
                  {reply}
                  {caret ? '|' : ''}
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </Animated.View>
      <View
        style={{
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(20, 48, 31, 0.16)',
          borderRadius: 999,
          backgroundColor: '#fff',
          paddingLeft: 16,
          paddingRight: 6,
          paddingVertical: 6,
        }}
      >
        <TextInput
          editable={false}
          placeholder="Write a message"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Message preview"
          style={{ flex: 1, color: colors.text, paddingVertical: 8 }}
        />
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.greenMid,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.cream }}>↑</Text>
        </View>
      </View>
    </View>
  );
}
