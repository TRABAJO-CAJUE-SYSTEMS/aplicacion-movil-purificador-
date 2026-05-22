import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { database, ref, onValue, set } from '../firebaseConfig';

interface DispositivoState {
  calidad_aire:  string;
  confianza_ia:  number;
  co2_ppm:       number;
  co_ppm:        number;
  nh3_ppm:       number;
  extractor:     string;
  gas_critico:   string;
  ultima_actualizacion: string;
}

interface LogEvento {
  id: string; hora: string; calidad: string; mensaje: string;
}

function colorCalidad(c: string): string {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return '#00AFAA';
  if (v === 'moderado')  return '#FF9800';
  if (v === 'peligroso') return '#F44336';
  return '#999';
}

function BarraConfianza({ valor, color }: { valor: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(valor / 100, 1), duration: 1000, useNativeDriver: false }).start();
  }, [valor]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 10, backgroundColor: '#eee', borderRadius: 5, overflow: 'hidden' }}>
      <Animated.View style={{ height: 10, borderRadius: 5, backgroundColor: color, width }} />
    </View>
  );
}

const CIUDAD = 'cochabamba';

const IAScreen: React.FC = () => {
  const [data,    setData]    = useState<DispositivoState | null>(null);
  const [online,  setOnline]  = useState(false);
  const [logs,    setLogs]    = useState<LogEvento[]>([]);
  const prevCalidadRef = useRef<string>('');
  const lastTimeRef    = useRef<number>(0);

  useEffect(() => {
    const unsub = onValue(ref(database, `dispositivos/${CIUDAD}`), (snap) => {
      if (snap.exists()) {
        const d = snap.val() as DispositivoState;
        setData(d);
        setOnline(true);
        lastTimeRef.current = Date.now();
      }
    });
    // Detectar desconexión
    const iv = setInterval(() => {
      if (lastTimeRef.current && (Date.now() - lastTimeRef.current) / 1000 > 30) {
        setOnline(false);
      }
    }, 5000);
    return () => { unsub(); clearInterval(iv); };
  }, []);

  // Logs de cambios
  useEffect(() => {
    const calidad = data?.calidad_aire ?? '';
    if (calidad && calidad !== prevCalidadRef.current) {
      const ahora = new Date();
      setLogs((prev) => [{
        id:      Math.random().toString(36).slice(2, 9),
        hora:    `${ahora.getHours().toString().padStart(2,'0')}:${ahora.getMinutes().toString().padStart(2,'0')}:${ahora.getSeconds().toString().padStart(2,'0')}`,
        calidad,
        mensaje: `IA clasificó el aire como ${calidad.toUpperCase()}`,
      }, ...prev].slice(0, 8));
      prevCalidadRef.current = calidad;
    }
  }, [data?.calidad_aire]);

  const devolverControlIA = async () => {
    try {
      await set(ref(database, `control/${CIUDAD}/modo_automatico`), true);
    } catch (e) { console.error(e); }
  };

  const getInsight = () => {
    const c = (data?.calidad_aire ?? '').toLowerCase();
    if (c === 'peligroso') return 'Niveles tóxicos detectados. Extractor a máxima potencia. Evacuar la zona si los valores no descienden.';
    if (c === 'moderado')  return 'Calidad degradada. Ventilación preventiva activa. Monitoreando tendencia cada 3 segundos.';
    if (c === 'bueno')     return 'Parámetros óptimos. Extractor en espera para ahorro energético. Sistema funcionando correctamente.';
    return 'Analizando ambiente con Edge Impulse v4...';
  };

  const aqiColor = colorCalidad(data?.calidad_aire ?? '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Monitor IA" />
      <ScrollView contentContainerStyle={styles.container}>

        {/* Estado conexión */}
        <View style={[styles.connectionBadge, { backgroundColor: online ? '#00AFAA15' : '#F4433615', borderColor: online ? '#00AFAA40' : '#F4433640' }]}>
          <View style={[styles.dot, { backgroundColor: online ? '#00AFAA' : '#F44336' }]} />
          <Text style={[styles.connectionText, { color: online ? '#00AFAA' : '#F44336' }]}>
            {online ? 'Sistema en Línea — Edge Impulse v4' : 'Desconectado (Revisar ESP32)'}
          </Text>
        </View>

        {/* Predicción principal */}
        <View style={[styles.card, { borderColor: aqiColor + '40' }]}>
          <Text style={styles.cardLabel}>CLASIFICACIÓN DEL MODELO</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <View style={[styles.aqiIcon, { backgroundColor: aqiColor + '15', borderColor: aqiColor + '50' }]}>
              <Text style={{ fontSize: 28 }}>
                {(data?.calidad_aire ?? '').toLowerCase() === 'bueno' ? '✓' : '⚠'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aqiValue, { color: aqiColor }]}>
                {data?.calidad_aire
                  ? data.calidad_aire.charAt(0).toUpperCase() + data.calidad_aire.slice(1).toLowerCase()
                  : 'Esperando...'}
              </Text>
              <Text style={styles.gasCritico}>Gas crítico: {data?.gas_critico || 'Ninguno'}</Text>
            </View>
          </View>
          <View style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.confLabel}>Certeza de la predicción</Text>
              <Text style={styles.confValue}>{(data?.confianza_ia ?? 0).toFixed(1)}%</Text>
            </View>
            <BarraConfianza valor={data?.confianza_ia ?? 0} color={aqiColor} />
          </View>
        </View>

        {/* Tarjetas extractor + modelo + inferencia */}
        <View style={styles.row3}>
          {[
            { emoji: data?.extractor === 'ON' ? '🔄' : '⏸️', label: 'Extractor', value: data?.extractor ?? '—', color: data?.extractor === 'ON' ? '#00AFAA' : '#999' },
            { emoji: '🧠', label: 'Modelo', value: 'EI v4',  color: '#818cf8' },
            { emoji: '⚡', label: 'Inferencia', value: '~45ms', color: '#FF9800' },
          ].map(({ emoji, label, value, color }) => (
            <View key={label} style={styles.miniCard}>
              <Text style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</Text>
              <Text style={styles.miniLabel}>{label}</Text>
              <Text style={[styles.miniValue, { color }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Sensores en evaluación */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SENSORES EN EVALUACIÓN</Text>
          {[
            { label: 'CO₂', value: data?.co2_ppm ?? 0, max: 2000, color: '#818cf8', dec: 0, umbral: 1000 },
            { label: 'CO',  value: data?.co_ppm  ?? 0, max: 50,   color: '#f97316', dec: 2, umbral: 8.7  },
            { label: 'NH₃', value: data?.nh3_ppm ?? 0, max: 50,   color: '#a78bfa', dec: 1, umbral: 25   },
          ].map(({ label, value, max, color, dec, umbral }) => {
            const alert = value > umbral;
            return (
              <View key={label} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.sensLabel, alert && { color, fontWeight: '700' }]}>{label}</Text>
                  <Text style={[styles.sensValue, alert && { color }]}>{value.toFixed(dec)} ppm</Text>
                </View>
                <View style={{ height: 5, backgroundColor: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: color, width: `${Math.min((value / max) * 100, 100)}%` }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Insight */}
        <View style={styles.insightCard}>
          <Text style={styles.insightHeader}>💬  Insight del Sistema</Text>
          <Text style={styles.insightText}>"{getInsight()}"</Text>
        </View>

        {/* Consola de logs */}
        <View style={styles.console}>
          <View style={styles.consoleHeader}>
            <Text style={styles.consoleTitle}>⌨  Historial de Decisiones IA</Text>
          </View>
          <View style={{ padding: 12, minHeight: 80 }}>
            {logs.length === 0 ? (
              <Text style={styles.consoleIdle}>Esperando cambios de estado...</Text>
            ) : logs.map((log) => (
              <View key={log.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
                <Text style={styles.consoleTime}>[{log.hora}]</Text>
                <Text style={[styles.consoleMsg, {
                  color: (log.calidad ?? '').toLowerCase() === 'peligroso' ? '#F44336' :
                         (log.calidad ?? '').toLowerCase() === 'moderado'  ? '#FF9800' : '#aaa'
                }]}>{log.mensaje}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Botón restaurar IA */}
        <TouchableOpacity style={styles.restoreBtn} onPress={devolverControlIA}>
          <Text style={styles.restoreBtnText}>🤖  Restaurar control a la IA</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

export default IAScreen;

const styles = StyleSheet.create({
  safeArea:       { flex: 1, backgroundColor: '#f5f5f5' },
  container:      { padding: 16, paddingBottom: 40 },
  connectionBadge:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 16, alignSelf: 'flex-start' },
  dot:            { width: 8, height: 8, borderRadius: 4 },
  connectionText: { fontSize: 12, fontWeight: '700' },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: '#eee' },
  cardLabel:      { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#999', textTransform: 'uppercase', marginBottom: 14 },
  aqiIcon:        { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  aqiValue:       { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  gasCritico:     { fontSize: 12, color: '#666', marginTop: 3 },
  confLabel:      { fontSize: 12, color: '#666' },
  confValue:      { fontSize: 13, fontWeight: '800', color: '#333' },
  row3:           { flexDirection: 'row', gap: 10, marginBottom: 14 },
  miniCard:       { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  miniLabel:      { fontSize: 9, fontWeight: '700', color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  miniValue:      { fontSize: 13, fontWeight: '900' },
  sensLabel:      { fontSize: 13, color: '#444' },
  sensValue:      { fontSize: 13, fontWeight: '700', color: '#333' },
  insightCard:    { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, marginBottom: 14 },
  insightHeader:  { fontSize: 13, fontWeight: '700', color: '#818cf8', marginBottom: 10 },
  insightText:    { fontSize: 13, color: '#c5c5e8', lineHeight: 20 },
  console:        { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  consoleHeader:  { backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  consoleTitle:   { fontSize: 11, fontWeight: '700', color: '#888', fontFamily: 'monospace' },
  consoleIdle:    { fontSize: 11, color: '#555', fontStyle: 'italic', fontFamily: 'monospace' },
  consoleTime:    { fontSize: 10, color: '#00AFAA', fontFamily: 'monospace', flexShrink: 0 },
  consoleMsg:     { fontSize: 10, fontFamily: 'monospace', flex: 1 },
  restoreBtn:     { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#818cf840' },
  restoreBtnText: { fontSize: 14, fontWeight: '800', color: '#818cf8' },
});
