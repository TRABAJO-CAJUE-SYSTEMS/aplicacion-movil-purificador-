import React, { useEffect, useRef, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Text, ActivityIndicator,
  Animated, TouchableOpacity, Alert, Linking, Platform, StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import TrendChart from '../components/TrendChart';
import { database, ref, onValue, query, limitToLast, orderByKey, auth } from '../firebaseConfig';
import { C, R, aqiColor, aqiDim, aqiLabel, aqiEmoji, aqiFromPM25, AQI_LEVELS } from '../theme';

interface SensorData {
  co2_ppm: number; co_ppm: number; nh3_ppm: number;
  pm25_ugm3?: number; cov_ppm?: number;
  humo_ppm?: number; alcohol_ppm?: number; benceno_ppm?: number; h2_ppm?: number;
  calidad_aire: string; gas_activador: string; confianza_ia?: number;
  metodo?: string; extractor: string; modo: string; timestamp: string;
}
interface TrendData {
  labels: string[]; co2: number[]; co: number[]; nh3: number[];
  pm25: number[]; cov: number[];
  alcohol: number[]; benceno: number[]; humo: number[]; h2: number[];
}
interface OpenAQMeasurement {
  parameter: string; value: number; unit: string; lastUpdated: string;
}
interface DispositivoInfo {
  id: string; nombre: string; ciudad: string; latitud?: number; longitud?: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function formatDist(km: number) { return km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`; }
function tiempoCaminando(km: number) {
  const mins = Math.round((km/5)*60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h ${mins%60}min`;
}

// ── Barra de gas animada ──────────────────────────────────
function GasBar({ label, value, max, color, unit, alert }: {
  label: string; value: number; max: number; color: string; unit: string; alert: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(value / max, 1), duration: 1000, useNativeDriver: false }).start();
  }, [value]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.gasRow}>
      <View style={styles.gasTop}>
        <Text style={[styles.gasLabel, alert && { color: C.red }]}>{label}</Text>
        <Text style={[styles.gasValue, { color: alert ? C.red : color }]}>
          {value.toFixed(unit === 'ppm' && value < 10 ? 2 : 0)} <Text style={styles.gasUnit}>{unit}</Text>
          {alert ? '  ⚠' : ''}
        </Text>
      </View>
      <View style={styles.gasTrack}>
        <Animated.View style={[styles.gasFill, { width, backgroundColor: alert ? C.red : color }]} />
      </View>
    </View>
  );
}

// ── AQI Ring ──────────────────────────────────────────────
function AQIRing({ calidad, pm25 }: { calidad: string; pm25?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const aqiKey = pm25 != null && pm25 > 0 ? aqiFromPM25(pm25) : (calidad.toLowerCase() as any);
  const color = aqiColor(aqiKey);
  const label = aqiLabel(aqiKey);
  const emoji = aqiEmoji(aqiKey);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [calidad]);
  return (
    <Animated.View style={[styles.aqiRing, { borderColor: color + '60', transform: [{ scale: pulse }] }]}>
      <View style={[styles.aqiInner, { backgroundColor: color + '15' }]}>
        <Text style={[styles.aqiEmoji]}>{emoji}</Text>
        <Text style={[styles.aqiText, { color }]}>{label}</Text>
        {pm25 != null && pm25 > 0 && (
          <Text style={styles.aqiSub}>{pm25.toFixed(1)} μg/m³</Text>
        )}
      </View>
    </Animated.View>
  );
}

export default function InicioScreen() {
  const uid = auth.currentUser?.uid ?? '';

  const [dispositivos,    setDispositivos]    = useState<DispositivoInfo[]>([]);
  const [dispositivoSel,  setDispositivoSel]  = useState<string>('');
  const [data,            setData]            = useState<SensorData | null>(null);
  const [trendData,       setTrendData]       = useState<TrendData>({ labels:[], co2:[], co:[], nh3:[], pm25:[], cov:[], alcohol:[], benceno:[], humo:[], h2:[] });
  const [loading,         setLoading]         = useState(true);
  const [nearest,         setNearest]         = useState<{ nombre: string; lat: number; lon: number; km: number } | null>(null);
  const [searching,       setSearching]       = useState(false);
  const [openaq,          setOpenaq]          = useState<OpenAQMeasurement[]>([]);
  const [loadingOAQ,      setLoadingOAQ]      = useState(false);

  // Cargar dispositivos del usuario
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onValue(ref(database, `dispositivos/${uid}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val() as Record<string, any>;
        const lista: DispositivoInfo[] = Object.entries(data).map(([id, d]) => ({
          id,
          nombre:   d.nombre   || id,
          ciudad:   d.ciudad   || '—',
          latitud:  d.latitud,
          longitud: d.longitud,
        }));
        setDispositivos(lista);
        if (!dispositivoSel && lista.length > 0) {
          setDispositivoSel(lista[0].id);
        }
      } else {
        setDispositivos([]);
      }
    });
    return () => unsub();
  }, [uid]);

  // Datos en TIEMPO REAL desde /dispositivos/ — actualiza cada 15 s (set, no crece)
  useEffect(() => {
    if (!uid || !dispositivoSel) { setLoading(false); return; }
    setLoading(true);
    setData(null);
    const unsub = onValue(ref(database, `dispositivos/${uid}/${dispositivoSel}`), (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setData({
          ...d,
          // Normalizar nombre del campo entre Arduino v4 y versiones anteriores
          gas_activador: d.gas_critico ?? d.gas_activador ?? 'Ninguno',
          timestamp:     d.ultima_actualizacion ?? d.timestamp ?? '',
        } as SensorData);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid, dispositivoSel]);

  // Gráfica de tendencia desde /data/ — últimos 10 registros históricos (cada 5 min)
  useEffect(() => {
    if (!uid || !dispositivoSel) return;
    const q = query(ref(database, `data/${uid}/${dispositivoSel}`), orderByKey(), limitToLast(10));
    const unsub = onValue(q, (snap) => {
      if (!snap.exists()) return;
      const registros = Object.entries(snap.val())
        .map(([k, v]: any) => ({ _key: k, ...v }))
        .sort((a, b) => a._key.localeCompare(b._key));
      const nuevo: TrendData = {
        labels: [], co2: [], co: [], nh3: [], pm25: [], cov: [],
        alcohol: [], benceno: [], humo: [], h2: [],
      };
      registros.forEach(d => {
        const hora = d.timestamp
          ? (d.timestamp as string).split(' ')[1]?.slice(0, 5) ?? ''
          : '';
        nuevo.labels.push(hora);
        nuevo.co2.push(d.co2_ppm ?? 0);
        nuevo.co.push(d.co_ppm ?? 0);
        nuevo.nh3.push(d.nh3_ppm ?? 0);
        nuevo.pm25.push(d.pm25_ugm3 ?? 0);
        nuevo.cov.push(d.cov_ppm ?? 0);
        nuevo.alcohol.push(d.alcohol_ppm ?? 0);
        nuevo.benceno.push(d.benceno_ppm ?? 0);
        nuevo.humo.push(d.humo_ppm ?? 0);
        nuevo.h2.push(d.h2_ppm ?? 0);
      });
      setTrendData(nuevo);
    });
    return () => unsub();
  }, [uid, dispositivoSel]);

  // OpenAQ para el dispositivo seleccionado (si tiene coordenadas)
  useEffect(() => {
    const dev = dispositivos.find(d => d.id === dispositivoSel);
    if (!dev?.latitud || !dev?.longitud) return;
    setLoadingOAQ(true);
    fetch(`https://api.openaq.org/v3/locations?coordinates=${dev.latitud},${dev.longitud}&radius=50000&limit=3&parameters_id=2,5,6`, {
      headers: { Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(json => {
        const loc = json?.results?.[0];
        if (!loc) return;
        const meds: OpenAQMeasurement[] = (loc.parameters ?? []).map((p: any) => ({
          parameter:   p.name ?? p.displayName ?? '—',
          value:       p.lastValue ?? 0,
          unit:        p.units ?? '—',
          lastUpdated: p.lastUpdated ?? '',
        }));
        setOpenaq(meds.filter(m => m.value > 0));
      })
      .catch(() => {})
      .finally(() => setLoadingOAQ(false));
  }, [dispositivoSel, dispositivos]);

  const handleFindNearest = async () => {
    setSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lon } = loc.coords;
      const candidatos = dispositivos.filter(d => d.latitud && d.longitud);
      if (candidatos.length === 0) { Alert.alert('Sin dispositivos con coordenadas'); return; }
      let mejor = candidatos[0];
      let minDist = haversineKm(lat, lon, mejor.latitud!, mejor.longitud!);
      candidatos.forEach(e => {
        const d = haversineKm(lat, lon, e.latitud!, e.longitud!);
        if (d < minDist) { minDist = d; mejor = e; }
      });
      setNearest({ nombre: mejor.nombre, lat: mejor.latitud!, lon: mejor.longitud!, km: minDist });
    } catch { Alert.alert('Error', 'No se pudo obtener la ubicación'); }
    finally { setSearching(false); }
  };

  const handleComoLlegar = () => {
    if (!nearest) return;
    const url = Platform.OS === 'ios' ? `maps:0,0?q=${nearest.lat},${nearest.lon}` : `geo:${nearest.lat},${nearest.lon}?q=${nearest.lat},${nearest.lon}`;
    Linking.canOpenURL(url)
      .then(can => Linking.openURL(can ? url : `https://www.google.com/maps/dir/?api=1&destination=${nearest.lat},${nearest.lon}`))
      .catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Header title="Inicio" subtitle="Monitor en tiempo real" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Selector de dispositivo ── */}
        {dispositivos.length === 0 ? (
          <View style={styles.noDevCard}>
            <Text style={styles.noDevText}>📡 Sin purificadores registrados</Text>
            <Text style={styles.noDevSub}>Ve a Dispositivos → Agregar purificador</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {dispositivos.map(d => (
              <TouchableOpacity key={d.id} onPress={() => setDispositivoSel(d.id)}
                style={[styles.devBtn, dispositivoSel === d.id && { backgroundColor: C.tealDim, borderColor: C.teal }]}>
                <Text style={[styles.devBtnLabel, dispositivoSel === d.id && { color: C.teal }]}>
                  {d.nombre}
                </Text>
                <Text style={styles.devBtnCiudad}>{d.ciudad}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── AQI Principal ── */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={C.teal} size="large" />
            <Text style={styles.loadingText}>Conectando al sensor...</Text>
          </View>
        ) : !data ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>📡 Sin datos del ESP32</Text>
          </View>
        ) : (
          <>
            <View style={styles.mainCard}>
              <View style={styles.mainCardInner}>
                <AQIRing calidad={data.calidad_aire} pm25={data.pm25_ugm3} />
                <View style={styles.mainInfo}>
                  {(data.confianza_ia ?? 0) > 0 && (
                    <View style={styles.iaBadge}>
                      <Text style={styles.iaBadgeText}>🧠 Edge Impulse v4</Text>
                      <Text style={[styles.iaConf, { color: C.teal }]}>{(data.confianza_ia ?? 0).toFixed(0)}%</Text>
                    </View>
                  )}
                  <View style={[styles.statusChip, { borderColor: data.extractor === 'ON' ? C.teal + '60' : C.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: data.extractor === 'ON' ? C.teal : C.textMuted }]} />
                    <Text style={[styles.statusText, { color: data.extractor === 'ON' ? C.teal : C.textMuted }]}>
                      Extractor {data.extractor}
                    </Text>
                  </View>
                  {data.gas_activador && data.gas_activador !== 'Ninguno' && (
                    <View style={[styles.statusChip, { borderColor: C.amber + '50' }]}>
                      <Text style={[styles.statusText, { color: C.amber }]}>⚠ {data.gas_activador}</Text>
                    </View>
                  )}
                  {data.metodo && <Text style={styles.metodoText}>{data.metodo}</Text>}
                </View>
              </View>

              <View style={styles.gasSeparator} />
              {(data.pm25_ugm3 ?? 0) > 0 && (
                <GasBar label="PM2.5 (Part.)" value={data.pm25_ugm3 ?? 0} max={250} color={C.pm25} unit="μg/m³" alert={(data.pm25_ugm3 ?? 0) > 55} />
              )}
              <GasBar label="CO₂ (Dióxido)"  value={data.co2_ppm ?? 0} max={5000} color={C.co2} unit="ppm" alert={(data.co2_ppm ?? 0) > 1000} />
              <GasBar label="CO (Monóxido)"   value={data.co_ppm  ?? 0} max={100}  color={C.co}  unit="ppm" alert={(data.co_ppm  ?? 0) > 8.7}  />
              <GasBar label="NH₃ (Amoniaco)"  value={data.nh3_ppm ?? 0} max={100}  color={C.nh3} unit="ppm" alert={(data.nh3_ppm ?? 0) > 25}   />
              {(data.cov_ppm ?? 0) > 0 && (
                <GasBar label="COV (Volát.)" value={data.cov_ppm ?? 0} max={10} color={C.cov} unit="ppm" alert={(data.cov_ppm ?? 0) > 1} />
              )}
              {(data.humo_ppm ?? 0) > 0 && (
                <GasBar label="Humo" value={data.humo_ppm ?? 0} max={200} color="#94a3b8" unit="ppm" alert={(data.humo_ppm ?? 0) > 50} />
              )}
            </View>

            {/* Estación más cercana */}
            {dispositivos.some(d => d.latitud && d.longitud) && (
              <TouchableOpacity style={styles.nearestBtn} onPress={handleFindNearest} disabled={searching}>
                <Text style={styles.nearestBtnText}>{searching ? '🔍 Buscando...' : '📍 Purificador más cercano'}</Text>
              </TouchableOpacity>
            )}

            {nearest && (
              <View style={styles.nearestCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nearestName}>{nearest.nombre}</Text>
                  <Text style={styles.nearestDist}>{formatDist(nearest.km)} · {tiempoCaminando(nearest.km)} caminando</Text>
                </View>
                <TouchableOpacity style={styles.goBtn} onPress={handleComoLlegar}>
                  <Text style={styles.goBtnText}>Ir →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* OpenAQ Referencia */}
            {(openaq.length > 0 || loadingOAQ) && (
              <View style={styles.oaqCard}>
                <View style={styles.oaqHeader}>
                  <Text style={styles.oaqTitle}>🌐 OpenAQ — Estación Oficial</Text>
                  <Text style={styles.oaqSub}>Red de monitoreo ambiental</Text>
                </View>
                {loadingOAQ ? (
                  <ActivityIndicator color={C.teal} size="small" />
                ) : (
                  <View style={styles.oaqRow}>
                    {openaq.slice(0, 4).map((m, i) => (
                      <View key={i} style={styles.oaqItem}>
                        <Text style={styles.oaqParam}>{m.parameter.toUpperCase()}</Text>
                        <Text style={styles.oaqValue}>{m.value.toFixed(1)}</Text>
                        <Text style={styles.oaqUnit}>{m.unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Gráfica de tendencia */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tendencia</Text>
              {data.timestamp ? <Text style={styles.sectionSub}>{data.timestamp.split(' ')[1]}</Text> : null}
            </View>
            <TrendChart trendData={trendData} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: C.bg },
  scroll:        { padding: 16, paddingBottom: 32 },
  // Sin dispositivos
  noDevCard:     { backgroundColor: C.bgCard, borderRadius: R.lg, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  noDevText:     { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  noDevSub:      { color: C.textMuted, fontSize: 12 },
  // Selector dispositivo
  devBtn:        { paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.sm, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, marginRight: 8, alignItems: 'center' },
  devBtnLabel:   { fontSize: 12, fontWeight: '800', color: C.textMuted },
  devBtnCiudad:  { fontSize: 10, color: C.textMuted, marginTop: 2 },
  // Loading
  loadingCard:   { backgroundColor: C.bgCard, borderRadius: R.lg, padding: 40, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  loadingText:   { color: C.textMuted, fontSize: 14, marginTop: 12 },
  // Main card
  mainCard:      { backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 12, elevation: 4 },
  mainCardInner: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 16 },
  // AQI Ring
  aqiRing:       { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  aqiInner:      { width: 106, height: 106, borderRadius: 53, alignItems: 'center', justifyContent: 'center' },
  aqiEmoji:      { fontSize: 26, marginBottom: 2 },
  aqiText:       { fontSize: 13, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center' },
  aqiSub:        { fontSize: 10, color: C.textMuted, marginTop: 2 },
  // Info lateral
  mainInfo:      { flex: 1, gap: 8 },
  iaBadge:       { backgroundColor: C.bgElevated, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: C.border },
  iaBadgeText:   { color: C.textMuted, fontSize: 10, fontWeight: '700' },
  iaConf:        { fontSize: 20, fontWeight: '900', marginTop: 2 },
  statusChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: C.bgElevated },
  statusDot:     { width: 7, height: 7, borderRadius: 3.5 },
  statusText:    { fontSize: 11, fontWeight: '700' },
  metodoText:    { fontSize: 9, color: C.textMuted, letterSpacing: 0.3 },
  // Gases
  gasSeparator:  { height: 1, backgroundColor: C.border, marginVertical: 14 },
  gasRow:        { marginBottom: 12 },
  gasTop:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  gasLabel:      { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  gasValue:      { fontSize: 13, fontWeight: '800' },
  gasUnit:       { fontSize: 10, fontWeight: '400', color: C.textMuted },
  gasTrack:      { height: 5, backgroundColor: C.bgElevated, borderRadius: 3, overflow: 'hidden' },
  gasFill:       { height: 5, borderRadius: 3 },
  // Nearest
  nearestBtn:    { backgroundColor: C.tealDim, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.tealBorder },
  nearestBtnText:{ color: C.teal, fontWeight: '800', fontSize: 14 },
  nearestCard:   { backgroundColor: C.bgCard, borderRadius: R.md, borderWidth: 1, borderColor: C.tealBorder, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 16, gap: 12 },
  nearestName:   { fontSize: 13, fontWeight: '800', color: C.textPrimary },
  nearestDist:   { fontSize: 12, color: C.teal, marginTop: 2, fontWeight: '600' },
  goBtn:         { backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  goBtnText:     { color: C.bg, fontWeight: '900', fontSize: 13 },
  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:  { fontSize: 14, fontWeight: '800', color: C.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionSub:    { fontSize: 12, color: C.textMuted },
  // OpenAQ
  oaqCard:       { backgroundColor: C.bgCard, borderRadius: R.lg, borderWidth: 1, borderColor: C.tealBorder, padding: 14, marginBottom: 12 },
  oaqHeader:     { marginBottom: 10 },
  oaqTitle:      { fontSize: 12, fontWeight: '800', color: C.teal, letterSpacing: 0.3 },
  oaqSub:        { fontSize: 10, color: C.textMuted, marginTop: 2 },
  oaqRow:        { flexDirection: 'row', gap: 8 },
  oaqItem:       { flex: 1, backgroundColor: C.bgElevated, borderRadius: R.sm, padding: 10, alignItems: 'center' },
  oaqParam:      { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 4 },
  oaqValue:      { fontSize: 16, fontWeight: '900', color: C.textPrimary },
  oaqUnit:       { fontSize: 9, color: C.textMuted, marginTop: 2 },
});
