import React from 'react';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions, View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

const screenWidth = Dimensions.get('window').width;

interface TrendData {
  labels: string[]; alcohol: number[]; benceno: number[];
  co: number[]; co2: number[]; h2: number[]; humo: number[]; nh3: number[];
}

const GAS_COLORS = [
  (o = 1) => `rgba(34,211,160,${o})`,   // alcohol — green
  (o = 1) => `rgba(251,113,133,${o})`,  // benceno — pink
  (o = 1) => `rgba(251,146,60,${o})`,   // co      — orange
  (o = 1) => `rgba(129,140,248,${o})`,  // co2     — violet
  (o = 1) => `rgba(56,189,248,${o})`,   // h2      — sky
  (o = 1) => `rgba(148,163,184,${o})`,  // humo    — slate
  (o = 1) => `rgba(167,139,250,${o})`,  // nh3     — purple
];
const GAS_LABELS = ['Alcohol','Benceno','CO','CO₂','H₂','Humo','NH₃'];

export default function TrendChart({ trendData }: { trendData: TrendData }) {
  const hasData = trendData.labels.length > 0;
  const safe = (arr: number[]) => arr.length < 2 ? [...arr, ...Array(2 - arr.length).fill(0)] : arr;
  const labels = trendData.labels.length < 2 ? [...trendData.labels, ''] : trendData.labels;

  return (
    <View style={styles.container}>
      {/* Leyenda */}
      <View style={styles.legend}>
        {GAS_LABELS.map((label, i) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: GAS_COLORS[i](1) }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {hasData ? (
        <View style={styles.chartWrap}>
          <LineChart
            data={{
              labels,
              datasets: [
                { data: safe(trendData.alcohol), color: GAS_COLORS[0], strokeWidth: 1.5 },
                { data: safe(trendData.benceno), color: GAS_COLORS[1], strokeWidth: 1.5 },
                { data: safe(trendData.co),      color: GAS_COLORS[2], strokeWidth: 2   },
                { data: safe(trendData.co2),     color: GAS_COLORS[3], strokeWidth: 2   },
                { data: safe(trendData.h2),      color: GAS_COLORS[4], strokeWidth: 1.5 },
                { data: safe(trendData.humo),    color: GAS_COLORS[5], strokeWidth: 1.5 },
                { data: safe(trendData.nh3),     color: GAS_COLORS[6], strokeWidth: 2   },
              ],
            }}
            width={screenWidth - 32}
            height={200}
            chartConfig={{
              backgroundColor:        C.bgCard,
              backgroundGradientFrom: C.bgCard,
              backgroundGradientTo:   C.bgCard,
              decimalPlaces: 1,
              color:       (o = 1) => `rgba(0,201,190,${o})`,
              labelColor:  (o = 1) => `rgba(138,155,176,${o})`,
              propsForDots: { r: '2.5' },
              propsForBackgroundLines: { stroke: C.border, strokeDasharray: '' },
            }}
            bezier
            withInnerLines={false}
            withOuterLines={false}
            style={styles.chart}
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>📡 Esperando lecturas...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  legend:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText:{ fontSize: 10, color: C.textMuted, fontWeight: '600' },
  chartWrap: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  chart:     { marginLeft: -10 },
  empty:     { height: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  emptyText: { color: C.textMuted, fontSize: 13 },
});
