import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from './theme';

export function Screen({ children, header = true }: { children: ReactNode; header?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: space.lg,
        paddingTop: header ? space.lg : insets.top + space.md,
        paddingBottom: insets.bottom + space.xl * 2,
        gap: space.md,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export const T = {
  Title: ({ children, style }: TextProps) => <Text style={[s.title, style]}>{children}</Text>,
  Big: ({ children, style }: TextProps) => <Text style={[s.big, style]}>{children}</Text>,
  H: ({ children, style }: TextProps) => <Text style={[s.h, style]}>{children}</Text>,
  Body: ({ children, style, numberOfLines }: TextProps) => (
    <Text style={[s.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  ),
  Mute: ({ children, style, numberOfLines }: TextProps) => (
    <Text style={[s.mute, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  ),
};

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({
  left,
  right,
  sub,
  icon,
  onPress,
  last,
  rightStyle,
}: {
  left: ReactNode;
  right?: ReactNode;
  sub?: ReactNode;
  icon?: string;
  onPress?: () => void;
  last?: boolean;
  rightStyle?: StyleProp<TextStyle>;
}) {
  const body = (
    <View style={[s.row, !last && s.rowLine]}>
      {icon ? (
        <View style={s.icon}>
          <Text style={{ fontSize: 15 }}>{icon}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.body} numberOfLines={1}>
          {left}
        </Text>
        {sub ? <Text style={s.mute} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right !== undefined ? <Text style={[s.body, { fontVariant: ['tabular-nums'] }, rightStyle]}>{right}</Text> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function ProgressBar({ value, color = colors.accent, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={[s.bar, { height }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Chips<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.chip, on && s.chipOn]} accessibilityState={{ selected: on }}>
            <Text style={[s.chipText, on && { color: colors.card }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<V extends string>(props: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={s.seg}>
      {props.options.map((o) => {
        const on = o.value === props.value;
        return (
          <Pressable key={o.value} onPress={() => props.onChange(o.value)} style={[s.segItem, on && s.segOn]} accessibilityState={{ selected: on }}>
            <Text style={[s.chipText, { fontWeight: on ? '600' : '400' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ title, onPress, ghost, disabled }: { title: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, ghost && s.btnGhost, (pressed || disabled) && { opacity: 0.5 }]}
    >
      <Text style={[s.btnText, ghost && { color: colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={[s.field, style as StyleProp<ViewStyle>]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.mute} style={s.input} {...props} />
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

export function Badge({ text, tone }: { text: string; tone: 'good' | 'warn' | 'mute' }) {
  const bg = tone === 'good' ? colors.accentSoft : tone === 'warn' ? colors.warnSoft : colors.fill;
  const fg = tone === 'good' ? colors.accent : tone === 'warn' ? colors.warn : colors.mute;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  big: { fontSize: 32, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  h: { fontSize: 16, fontWeight: '600', color: colors.ink },
  body: { fontSize: 14, color: colors.ink },
  mute: { fontSize: 12, color: colors.mute },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: space.sm },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  bar: { backgroundColor: colors.fill, borderRadius: 8, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.ink },
  seg: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.sm, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 6 },
  segOn: { backgroundColor: colors.card },
  btn: { backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.ink },
  btnText: { color: colors.card, fontWeight: '600', fontSize: 15 },
  field: { backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  fieldLabel: { fontSize: 12, color: colors.mute },
  input: { fontSize: 16, color: colors.ink, paddingVertical: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pos: { color: colors.accent },
  neg: { color: colors.warn },
});
