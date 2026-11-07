import { useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { formatCompact } from '../lib/money';
import { colors } from './theme';

/** Measures its own width so charts fill their card. */
function Sized({ height, children }: { height: number; children: (w: number) => ReactNode }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View style={{ height }} onLayout={onLayout}>
      {w > 0 ? children(w) : null}
    </View>
  );
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag / 0.5) * 0.5 * mag;
};

/* ---------- Line ---------- */

export function LineChart({ values, height = 90, color = colors.ink }: { values: number[]; height?: number; color?: string }) {
  return (
    <Sized height={height}>
      {(w) => {
        if (values.length < 2) return null;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const pad = 6;
        const x = (i: number) => (i / (values.length - 1)) * (w - pad * 2) + pad;
        const y = (v: number) => pad + (1 - (max === min ? 0.5 : (v - min) / (max - min))) * (height - pad * 2);
        const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
        const area = `${d} L${x(values.length - 1)},${height} L${x(0)},${height} Z`;
        const last = values.length - 1;
        return (
          <Svg width={w} height={height}>
            <Path d={area} fill={color} opacity={0.06} />
            <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(last)} cy={y(values[last])} r={4} fill={color} />
          </Svg>
        );
      }}
    </Sized>
  );
}

/* ---------- Paired bars (in vs out) ---------- */

export function InOutBars({
  data,
  height = 170,
  selected,
  onSelect,
}: {
  data: { label: string; in: number; out: number }[];
  height?: number;
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <Sized height={height}>
      {(w) => {
        const axisH = 18;
        const plotH = height - axisH;
        const max = niceMax(Math.max(...data.flatMap((d) => [d.in, d.out])));
        const slot = w / data.length;
        const bw = Math.min(16, slot / 3);
        const y = (v: number) => plotH - (v / max) * (plotH - 4);
        return (
          <Svg width={w} height={height}>
            <Line x1={0} x2={w} y1={plotH} y2={plotH} stroke={colors.line} />
            {data.map((d, i) => {
              const cx = slot * i + slot / 2;
              const dim = selected !== undefined && selected !== i ? 0.35 : 1;
              return (
                <G key={i} opacity={dim} onPress={onSelect ? () => onSelect(i) : undefined}>
                  <Rect x={cx - slot / 2} y={0} width={slot} height={height} fill="transparent" />
                  <Rect x={cx - bw - 1} y={y(d.in)} width={bw} height={plotH - y(d.in)} rx={3} fill={colors.accent} />
                  <Rect x={cx + 1} y={y(d.out)} width={bw} height={plotH - y(d.out)} rx={3} fill={colors.warn} />
                  <SvgText x={cx} y={height - 4} fontSize={10} fontFamily="System, -apple-system, sans-serif" textAnchor="middle" fill={colors.mute}>
                    {d.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        );
      }}
    </Sized>
  );
}

/* ---------- Stacked area (goal forecast) ---------- */

export interface StackSeries {
  values: number[];
  color: string;
  opacity?: number;
}

export function StackedArea({
  series,
  target,
  markers = [],
  labels,
  height = 170,
}: {
  /** Bottom-to-top layers; each array has one value per point */
  series: StackSeries[];
  target: number;
  /** Vertical markers at point indexes, e.g. a TD maturity */
  markers?: { index: number; label: string }[];
  /** Optional x labels: point index → text */
  labels?: { index: number; text: string }[];
  height?: number;
}) {
  return (
    <Sized height={height}>
      {(w) => {
        const n = series[0]?.values.length ?? 0;
        if (n < 2) return null;
        const axisH = 16;
        const plotH = height - axisH;
        const totals = Array.from({ length: n }, (_, i) => series.reduce((s, l) => s + l.values[i], 0));
        const max = niceMax(Math.max(target * 1.08, ...totals));
        const x = (i: number) => (i / (n - 1)) * w;
        const y = (v: number) => plotH - (v / max) * plotH;

        let base = new Array(n).fill(0);
        const paths = series.map((layer) => {
          const top = base.map((b, i) => b + layer.values[i]);
          const up = top.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
          const down = base
            .map((v, i) => [i, v] as const)
            .reverse()
            .map(([i, v]) => `L${x(i)},${y(v)}`)
            .join(' ');
          base = top;
          return { d: `${up} ${down} Z`, color: layer.color, opacity: layer.opacity ?? 1 };
        });
        const ty = y(target);
        return (
          <Svg width={w} height={height}>
            {paths.map((p, i) => (
              <Path key={i} d={p.d} fill={p.color} opacity={p.opacity} />
            ))}
            <Line x1={0} x2={w} y1={ty} y2={ty} stroke={colors.ink} strokeDasharray="4 4" strokeWidth={1} />
            <SvgText x={4} y={ty - 5} fontSize={10} fontFamily="System, -apple-system, sans-serif" fill={colors.ink}>
              {`${formatCompact(target)} target`}
            </SvgText>
            {markers.map((m, i) => (
              <G key={i}>
                <Line x1={x(m.index)} x2={x(m.index)} y1={0} y2={plotH} stroke={colors.mute} strokeDasharray="2 3" />
                <SvgText
                  x={x(m.index) + (x(m.index) > w - 70 ? -4 : 4)}
                  y={plotH - 6 - i * 12}
                  fontSize={9} fontFamily="System, -apple-system, sans-serif"
                  fill={colors.mute}
                  textAnchor={x(m.index) > w - 70 ? 'end' : 'start'}
                >
                  {m.label}
                </SvgText>
              </G>
            ))}
            <Line x1={0} x2={w} y1={plotH} y2={plotH} stroke={colors.line} />
            {labels?.map((l) => (
              <SvgText
                key={l.index}
                x={x(l.index)}
                y={height - 3}
                fontSize={10} fontFamily="System, -apple-system, sans-serif"
                fill={colors.mute}
                textAnchor={l.index === 0 ? 'start' : l.index === n - 1 ? 'end' : 'middle'}
              >
                {l.text}
              </SvgText>
            ))}
          </Svg>
        );
      }}
    </Sized>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: it.color }} />
          <Text style={{ fontSize: 12, color: colors.mute }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

