import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { database, ref, onValue, query, limitToLast, orderByKey } from '../firebaseConfig';

interface DispositivoState {
  calidad_aire: string;
  co2_ppm: number;
  co_ppm: number;
  nh3_ppm: number;
  gas_critico: string;
}

const CIUDADES_IDS = ['cochabamba', 'la_paz', 'santa_cruz'];
const COLORES = { bueno: '#00AFAA', moderado: '#FF9800', peligroso: '#F44336', default: '#999' };

function colorCalidad(c: string): string {
  const v = (c ?? '').toLowerCase();
  return COLORES[v as keyof typeof COLORES] ?? COLORES.default;
}

function bgCalidad(c: string): string {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return '#00AFAA15';
  if (v === 'moderado')  return '#FF980015';
  if (v === 'peligroso') return '#F4433615';
  return '#f5f5f5';
}

function textoSimple(c: string): string {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return 'Aire Saludable';
  if (v === 'moderado')  return 'Precaución';
  if (v === 'peligroso') return 'Peligroso';
  return 'Sin datos';
}

function normalizar(c: string) {
  if (!c) return '—';
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

// Barra de índice de salud
function HealthBar({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 1000, useNativeDriver: false }).start();
  }, [value]);
  const w = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const color = value >= 80 ? '#00AFAA' : value >= 50 ? '#FF9800' : '#F44336';
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, color: '#666' }}>Índice de Salud</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color }}>{value}/100</Text>
      </View>
      <View style={{ height: 10, backgroundColor: '#eee', borderRadius: 5, overflow: 'hidden' }}>
        <Animated.View style={{ height: 10, borderRadius: 5, backgroundColor: color, width: w }} />
      </View>
    </View>
  );
}

const SaludScreen: React.FC = () => {
  const [ciudadesData, setCiudadesData] = useState<Record<string, DispositivoState | null>>({
    cochabamba: null, la_paz: null, santa_cruz: null,
  });

  // Escuchar /dispositivos/{ciudad} — datos en tiempo real del ESP32
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    CIUDADES_IDS.forEach((id) => {
      const unsub = onValue(ref(database, `dispositivos/${id}`), (snap) => {
        if (snap.exists()) {
          setCiudadesData((prev) => ({ ...prev, [id]: snap.val() as DispositivoState }));
        }
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((fn) => fn());
  }, []);

  // Calidad global: el peor entre todas las ciudades
  const todasCalidades = Object.values(ciudadesData)
    .filter(Boolean)
    .map((d) => (d!.calidad_aire ?? '').toLowerCase());

  const calidadGlobal =
    todasCalidades.includes('peligroso') ? 'peligroso' :
    todasCalidades.includes('moderado')  ? 'moderado'  :
    todasCalidades.length > 0            ? 'bueno'     : '';

  const esBueno    = calidadGlobal === 'bueno';
  const esModerado = calidadGlobal === 'moderado';

  // Índice de salud calculado desde datos reales
  const datoRef = ciudadesData['cochabamba'] ?? Object.values(ciudadesData).find(Boolean);
  const calcularIndice = (): number => {
    if (!datoRef) return 100;
    let score = 100;
    if (datoRef.co2_ppm > 2500)      score -= 30; else if (datoRef.co2_ppm > 1500) score -= 15;
    if (datoRef.co_ppm  > 87)        score -= 30; else if (datoRef.co_ppm  > 30)   score -= 10;
    if (datoRef.nh3_ppm > 50)        score -= 25; else if (datoRef.nh3_ppm > 25)   score -= 10;
    return Math.max(score, 0);
  };
  const indiceSalud = calcularIndice();

  const grupos = [
    { emoji: '👤', titulo: 'Población General',
      desc: esBueno ? 'Actividades normales al aire libre sin restricciones.'
          : esModerado ? 'Reducir actividades prolongadas en exteriores.'
          : 'Evitar salir. Mantener espacios ventilados.',
      color: esBueno ? '#00AFAA' : esModerado ? '#FF9800' : '#F44336' },
    { emoji: '👶', titulo: 'Niños',
      desc: esBueno ? 'Pueden jugar al aire libre con normalidad.'
          : 'Limitar tiempo al aire libre. Priorizar interiores.',
      color: esBueno ? '#00AFAA' : '#F44336' },
    { emoji: '👴', titulo: 'Adultos Mayores',
      desc: esBueno ? 'Actividades normales con precaución habitual.'
          : 'Precaución especial si tiene enfermedades respiratorias.',
      color: esBueno ? '#00AFAA' : '#FF9800' },
    { emoji: '🏃', titulo: 'Deportistas',
      desc: esBueno ? 'Puede entrenar al aire libre con normalidad.'
          : 'Reducir intensidad. Evitar zonas de alto tráfico.',
      color: esBueno ? '#00AFAA' : '#FF9800' },
    { emoji: '🫁', titulo: 'Asma / EPOC',
      desc: esBueno ? 'Condiciones favorables. Mantener medicación preventiva.'
          : 'Alto riesgo. Tener broncodilatador disponible.',
      color: esBueno ? '#00AFAA' : '#F44336' },
    { emoji: '🤰', titulo: 'Embarazadas',
      desc: esBueno ? 'Sin riesgo adicional. Actividad normal.'
          : esModerado ? 'Evitar exposición prolongada.'
          : 'Evitar exterior. Consultar médico si hay síntomas.',
      color: esBueno ? '#00AFAA' : esModerado ? '#FF9800' : '#F44336' },
  ];

  const actividades = [
    { emoji: '🚶', titulo: 'Paseo al aire libre',   ok: esBueno },
    { emoji: '🚴', titulo: 'Ejercicio exterior',    ok: esBueno },
    { emoji: '🌬️', titulo: 'Ventilación natural',  ok: calidadGlobal !== 'peligroso' },
    { emoji: '⚡',  titulo: 'Actividades intensas', ok: esBueno },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Salud" />
      <ScrollView contentContainerStyle={styles.container}>

        {/* ── Estado global ── */}
        <View style={[styles.globalCard, { borderColor: colorCalidad(calidadGlobal) }]}>
          <Text style={styles.globalLabel}>ESTADO GLOBAL DEL AIRE</Text>
          <Text style={[styles.globalValue, { color: colorCalidad(calidadGlobal) }]}>
            {textoSimple(calidadGlobal) || 'Esperando datos...'}
          </Text>
          <Text style={styles.globalSub}>Basado en el peor valor entre todas las ciudades</Text>
          <View style={{ marginTop: 14, width: '100%' }}>
            <HealthBar value={indiceSalud} />
          </View>
        </View>

        {/* ── Estado por ciudad ── */}
        <Text style={styles.sectionTitle}>Por ciudad</Text>
        {([
          { id: 'cochabamba', label: 'Cochabamba' },
          { id: 'la_paz',     label: 'La Paz'     },
          { id: 'santa_cruz', label: 'Santa Cruz' },
        ] as const).map(({ id, label }) => {
          const d = ciudadesData[id];
          return (
            <View key={id} style={[styles.cityCard, { borderColor: colorCalidad(d?.calidad_aire ?? '') + '40' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityName}>{label}</Text>
                {d && (
                  <Text style={styles.cityGases}>
                    CO₂: {d.co2_ppm?.toFixed(0)} · CO: {d.co_ppm?.toFixed(2)} · NH₃: {d.nh3_ppm?.toFixed(1)} ppm
                  </Text>
                )}
              </View>
              <View style={[styles.aqiBadge, { backgroundColor: bgCalidad(d?.calidad_aire ?? '') }]}>
                <Text style={[styles.aqiBadgeText, { color: colorCalidad(d?.calidad_aire ?? '') }]}>
                  {d ? normalizar(d.calidad_aire) : 'Sin datos'}
                </Text>
              </View>
            </View>
          );
        })}

        {/* ── Grupos de población ── */}
        <Text style={styles.sectionTitle}>Por grupo de población</Text>
        {grupos.map((g) => (
          <View key={g.titulo} style={[styles.groupCard, { borderColor: g.color + '30' }]}>
            <View style={[styles.groupIcon, { backgroundColor: g.color + '15' }]}>
              <Text style={{ fontSize: 22 }}>{g.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle}>{g.titulo}</Text>
              <Text style={styles.groupDesc}>{g.desc}</Text>
            </View>
            <View style={[styles.groupBadge, { backgroundColor: g.color + '15' }]}>
              <Text style={[styles.groupBadgeText, { color: g.color }]}>
                {g.color === '#00AFAA' ? 'OK' : g.color === '#FF9800' ? 'CUIDADO' : 'RIESGO'}
              </Text>
            </View>
          </View>
        ))}

        {/* ── Actividades ── */}
        <Text style={styles.sectionTitle}>Actividades recomendadas</Text>
        <View style={styles.actGrid}>
          {actividades.map((a) => (
            <View key={a.titulo} style={[styles.actCard, { borderColor: (a.ok ? '#00AFAA' : '#F44336') + '30' }]}>
              <View style={[styles.actIcon, { backgroundColor: (a.ok ? '#00AFAA' : '#F44336') + '15' }]}>
                <Text style={{ fontSize: 22 }}>{a.emoji}</Text>
              </View>
              <Text style={styles.actTitle}>{a.titulo}</Text>
              <Text style={[styles.actStatus, { color: a.ok ? '#00AFAA' : '#F44336' }]}>
                {a.ok ? 'Permitido' : 'No recomendado'}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Tips ── */}
        <View style={styles.tipsCard}>
          <Text style={styles.sectionTitle}>Consejos preventivos</Text>
          {[
            { e: '💧', t: 'Manténgase hidratado' },
            { e: '😷', t: 'Use mascarilla N95 si el aire es peligroso' },
            { e: '🌿', t: 'Encienda el purificador en interiores' },
            { e: '🩺', t: 'Monitoree síntomas respiratorios' },
          ].map(({ e, t }) => (
            <View key={t} style={styles.tipRow}>
              <Text style={{ fontSize: 18 }}>{e}</Text>
              <Text style={styles.tipText}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SaludScreen;

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#f5f5f5' },
  container:     { padding: 16, paddingBottom: 40 },
  globalCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 2, alignItems: 'center', elevation: 3 },
  globalLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#999', textTransform: 'uppercase', marginBottom: 8 },
  globalValue:   { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  globalSub:     { fontSize: 12, color: '#666', textAlign: 'center' },
  sectionTitle:  { fontSize: 16, fontWeight: 'bold', marginVertical: 12, color: '#333' },
  cityCard:      { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, elevation: 1 },
  cityName:      { fontSize: 14, fontWeight: '700', color: '#333' },
  cityGases:     { fontSize: 11, color: '#888', marginTop: 2 },
  aqiBadge:      { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  aqiBadgeText:  { fontSize: 11, fontWeight: '800' },
  groupCard:     { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, elevation: 1 },
  groupIcon:     { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupTitle:    { fontSize: 13, fontWeight: '800', color: '#333' },
  groupDesc:     { fontSize: 11, color: '#666', marginTop: 3, lineHeight: 16 },
  groupBadge:    { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  groupBadgeText:{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  actGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  actCard:       { width: '47%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', elevation: 1 },
  actIcon:       { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actTitle:      { fontSize: 12, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 4 },
  actStatus:     { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tipsCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 1 },
  tipRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tipText:       { fontSize: 13, color: '#444', flex: 1 },
});
