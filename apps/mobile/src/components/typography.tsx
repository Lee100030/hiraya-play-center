import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';
import { type as scale } from '../theme';

type Props = TextProps & { children?: ReactNode };

export function Kicker({ style, ...props }: Props) {
  return <Text {...props} style={[scale.kicker, style]} />;
}

export function Title({ style, ...props }: Props) {
  return <Text {...props} style={[scale.title, style]} />;
}

export function Heading({ style, ...props }: Props) {
  return <Text {...props} style={[scale.heading, style]} />;
}

export function Body({ style, ...props }: Props) {
  return <Text {...props} style={[scale.body, style]} />;
}

export function Caption({ style, ...props }: Props) {
  return <Text {...props} style={[scale.caption, style]} />;
}

export function Label({ style, ...props }: Props) {
  return <Text {...props} style={[scale.label, style]} />;
}
