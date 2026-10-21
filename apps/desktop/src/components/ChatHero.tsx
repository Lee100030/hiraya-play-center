import { useEffect, useRef, useState } from 'react';

const USER_LINE = "Can I message my child's teacher?";
const REPLY_WORDS = ['Yes.', 'Pick', 'their', 'name', 'and', 'send', 'a', 'short', 'note.'];
const CHAR_MS = 48;
const WORD_MS = 150;
const DOTS_MS = 900;
const HOLD_MS = 2500;
const FADE_MS = 400;

export function ChatHero() {
  const rootRef = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const running = useRef(false);
  const [userCount, setUserCount] = useState(0);
  const [userIn, setUserIn] = useState(false);
  const [assistant, setAssistant] = useState<'hidden' | 'dots' | 'stream'>('hidden');
  const [wordCount, setWordCount] = useState(0);
  const [caret, setCaret] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const clearTimers = () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.current = timers.current.filter((item) => item !== id);
        if (!running.current) return;
        fn();
      }, ms);
      timers.current.push(id);
    };

    const showFinished = () => {
      running.current = false;
      clearTimers();
      setFading(false);
      setUserIn(true);
      setUserCount(USER_LINE.length);
      setAssistant('stream');
      setWordCount(REPLY_WORDS.length);
      setCaret(false);
    };

    const play = () => {
      if (!running.current) return;
      setFading(false);
      setUserIn(false);
      setUserCount(0);
      setAssistant('hidden');
      setWordCount(0);
      setCaret(false);
      later(() => {
        setUserIn(true);
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
                setFading(true);
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
      if (media.matches || running.current) return;
      running.current = true;
      play();
    };

    const stop = () => {
      running.current = false;
      clearTimers();
    };

    const onMotion = () => {
      if (media.matches) showFinished();
      else start();
    };
    media.addEventListener('change', onMotion);

    if (media.matches) showFinished();

    const observer = new IntersectionObserver(
      (entries) => {
        if (media.matches) return;
        if (entries.some((entry) => entry.isIntersecting)) start();
        else stop();
      },
      { threshold: 0.25 },
    );
    observer.observe(root);

    return () => {
      stop();
      observer.disconnect();
      media.removeEventListener('change', onMotion);
    };
  }, []);

  const reply = REPLY_WORDS.slice(0, wordCount).join(' ');

  return (
    <section className="ai-hero" ref={rootRef} aria-labelledby="ai-hero-title">
      <h2 id="ai-hero-title" className="ai-hero-title">
        Message the center
      </h2>
      <div className={fading ? 'ai-thread is-fading' : 'ai-thread'} role="log" aria-live="off">
        <div className="ai-user">
          <p className={userIn ? 'ai-bubble ai-bubble-user is-in' : 'ai-bubble ai-bubble-user'}>
            {userCount > 0 ? USER_LINE.slice(0, userCount) : '\u00A0'}
          </p>
        </div>
        {assistant !== 'hidden' ? (
          <div className="ai-assistant">
            <span className="ai-spark" aria-hidden="true">
              ✦
            </span>
            <p className="ai-bubble ai-bubble-bot">
              {assistant === 'dots' ? (
                <span className="ai-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <>
                  {reply}
                  {caret ? <span className="ai-caret" aria-hidden="true" /> : null}
                </>
              )}
            </p>
          </div>
        ) : null}
      </div>
      <label className="ai-pill">
        <input readOnly tabIndex={-1} placeholder="Write a message" aria-label="Message preview" />
        <span className="ai-pill-send" aria-hidden="true">
          ↑
        </span>
      </label>
    </section>
  );
}
