import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Switch, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import Header from '../components/Header';
import { database, ref, onValue, set, auth } from '../firebaseConfig';

const isExpoGo = (() => {
  const constants = Constants as any;
  return typeof constants.isExpoGo === 'boolean'
    ? constants.isExpoGo
    : constants.appOwnership === 'expo';
})();

interface DispositivoState {
  nombre?:       string;
  calidad_aire:  string;
  co2_ppm:       number;
  co_ppm:        number;
  nh3_ppm:       number;
  pm25_ugm3?:    number;
  gas_critico:   string;
  extractor:     string;
  ultima_actualizacion?: string;
}

function colorCalidad(c: string) {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return '#4CAF50';
  if (v === 'moderado')  return '#FF9800';
  if (v === 'peligroso') return '#F44336';
  return '#aaa';
}
function textoSimple(c: string) {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return 'Aire Saludable';
  if (v === 'moderado')  return 'Precaución';
  if (v === 'peligroso') return 'Peligroso';
  return 'Sin datos';
}

export default function AlertasScreen() {
  const uid = auth.currentUser?.uid ?? '';

  const [pushEnabled,  setPushEnabled]  = useState(true);
  const [umbralCO2,    setUmbralCO2]    = useState(1000);
  const [umbralCO,     setUmbralCO]     = useState(8.7);
  const [umbralPM25,   setUmbralPM25]   = useState(55);
  const [datos, setDatos]               = useState<Record<string, DispositivoState>>({});
  const [alertasActivas, setAlertasActivas] = useState<{ id: string; nombre: string; data: DispositivoState }[]>([]);
  const notificadasRef = React.useRef<Set<string>>(new Set());
  const umbralesGuardadosRef = React.useRef(false);

  // Cargar umbrales desde usuarios/{uid}/alertas/
  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(database, `usuarios/${uid}/alertas`), (snap) => {
      if (snap.exists() && !umbralesGuardadosRef.current) {
        const d = snap.val();
        if (d.co2  !== undefined) setUmbralCO2(d.co2);
        if (d.co   !== undefined) setUmbralCO(d.co);
        if (d.pm25 !== undefined) setUmbralPM25(d.pm25);
      }
    }, { onlyOnce: true });
    return () => unsub();
  }, [uid]);

  // Guardar umbrales en Firebase cuando cambian
  const guardarUmbrales = async (co2: number, co: number, pm25: number) => {
    if (!uid) return;
    umbralesGuardadosRef.current = true;
    try {
      await set(ref(database, `usuarios/${uid}/alertas`), { co2, co, pm25 });
    } catch {}
  };

  // Escuchar dispositivos/{uid}/ — todos los del usuario
  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(database, `dispositivos/${uid}`), (snap) => {
      if (snap.exists()) {
        setDatos(snap.val() as Record<string, DispositivoState>);
      } else {
        setDatos({});
      }
    });
    return () => unsub();
  }, [uid]);

  // Evaluar alertas cuando cambian los datos
  useEffect(() => {
    const activas: { id: string; nombre: string; data: DispositivoState }[] = [];
    Object.entries(datos).forEach(([id, d]) => {
      const nombre = d.nombre || id;
      const c = (d.calidad_aire ?? '').toLowerCase();
      const dispara = c === 'peligroso' ||
        (d.pm25_ugm3 ?? 0) > umbralPM25 ||
        (c === 'moderado' && ((d.co2_ppm ?? 0) > umbralCO2 || (d.co_ppm ?? 0) > umbralCO));
      if (dispara) {
        activas.push({ id, nombre, data: d });
        const key = `${id}-${c}`;
        if (pushEnabled && !notificadasRef.current.has(key)) {
          notificadasRef.current.add(key);
          if (!isExpoGo) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: `⚠ Aire ${textoSimple(d.calidad_aire)} — Tu purificador: ${nombre}`,
                body: `Gas crítico: ${d.gas_critico || '—'} · CO₂: ${(d.co2_ppm ?? 0).toFixed(0)} ppm · CO: ${(d.co_ppm ?? 0).toFixed(2)} ppm. ${
                  c === 'peligroso'
                    ? 'Evite salir. Active el purificador.'
                    : 'Reduzca actividades al exterior.'}`,
              },
              trigger: null,
            }).catch(() => {});
          }
        }
      }
    });
    setAlertasActivas(activas);
  }, [datos, umbralCO2, umbralCO, umbralPM25, pushEnabled]);

  const cambiarUmbral = (gas: 'co2' | 'co' | 'pm25', dir: 'up' | 'down') => {
    let nuevoCO2 = umbralCO2, nuevoCO = umbralCO, nuevoPM25 = umbralPM25;
    if (gas === 'co2') {
      nuevoCO2 = Math.max(400, dir === 'up' ? umbralCO2 + 100 : umbralCO2 - 100);
      setUmbralCO2(nuevoCO2);
    } else if (gas === 'co') {
      nuevoCO = Math.max(1, dir === 'up' ? Math.round((umbralCO + 1) * 10) / 10 : Math.round((umbralCO - 1) * 10) / 10);
      setUmbralCO(nuevoCO);
    } else {
      nuevoPM25 = Math.max(12, dir === 'up' ? umbralPM25 + 5 : umbralPM25 - 5);
      setUmbralPM25(nuevoPM25);
    }
    guardarUmbrales(nuevoCO2, nuevoCO, nuevoPM25);
  };

  const listaDispositivos = Object.entries(datos);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Alertas" />
      <ScrollView contentContainerStyle={styles.container}>

        {/* Toggle notificaciones */}
        <View style={styles.toggleCard}>
          <View>
            <Text style={styles.toggleTitle}>Notificaciones push</Text>
            <Text style={styles.toggleSub}>{pushEnabled ? 'Activas' : 'Desactivadas'}</Text>
          </View>
          <Switch value={pushEnabled} onValueChange={setPushEnabled}
            trackColor={{ false: '#ccc', true: '#00AFAA80' }}
            thumbColor={pushEnabled ? '#00AFAA' : '#aaa'}
            ios_backgroundColor="#ccc" />
        </View>

        {/* Umbrales */}
        <Text style={styles.sectionTitle}>Mis umbrales de alerta</Text>
        <View style={styles.umbralesRow}>
          {([
            { label: 'CO₂',   gas: 'co2'  as const, value: umbralCO2,  color: '#818cf8', unit: 'ppm' },
            { label: 'CO',    gas: 'co'   as const, value: umbralCO,   color: '#f97316', unit: 'ppm' },
            { label: 'PM2.5', gas: 'pm25' as const, value: umbralPM25, color: '#F43F5E', unit: 'μg/m³' },
          ]).map(({ label, gas, value, color, unit }) => (
            <View key={gas} style={[styles.umbralCard, { borderColor: color + '30' }]}>
              <Text style={[styles.umbralGas, { color }]}>{label}</Text>
              <View style={styles.umbralControls}>
                <TouchableOpacity style={styles.umbralBtn} onPress={() => cambiarUmbral(gas, 'down')}>
                  <Text style={styles.umbralBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.umbralValue}>{typeof value === 'number' ? value.toFixed(gas === 'co' ? 1 : 0) : '—'}</Text>
                <TouchableOpacity style={styles.umbralBtn} onPress={() => cambiarUmbral(gas, 'up')}>
                  <Text style={styles.umbralBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.umbralUnit}>{unit} alerta</Text>
            </View>
          ))}
        </View>

        {/* Estado en tiempo real — dispositivos del usuario */}
        <Text style={styles.sectionTitle}>Mis purificadores en tiempo real</Text>

        {listaDispositivos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>📡 Sin purificadores registrados</Text>
            <Text style={styles.emptyDesc}>Ve a Dispositivos → Agregar purificador</Text>
          </View>
        ) : (
          listaDispositivos.map(([id, d]) => {
            const color = colorCalidad(d.calidad_aire);
            const nombre = d.nombre || id;
            return (
              <View key={id} style={[styles.ciudadCard, { borderColor: color + '40' }]}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ciudadLabel}>{nombre}</Text>
                  <Text style={styles.ciudadGases}>
                    PM2.5: {(d.pm25_ugm3 ?? 0).toFixed(1)} μg/m³ · CO₂: {(d.co2_ppm ?? 0).toFixed(0)} · CO: {(d.co_ppm ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.aqiBadge, { backgroundColor: color + '15' }]}>
                  <Text style={[styles.aqiBadgeText, { color }]}>{textoSimple(d.calidad_aire)}</Text>
                </View>
              </View>
            );
          })
        )}

        {/* Alertas activas */}
        {alertasActivas.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: '#F44336' }]}>
              ⚠ {alertasActivas.length} alerta{alertasActivas.length > 1 ? 's' : ''} activa{alertasActivas.length > 1 ? 's' : ''}
            </Text>
            {alertasActivas.map((a, i) => {
              const color = colorCalidad(a.data.calidad_aire);
              return (
                <View key={i} style={[styles.alertaCard, { borderColor: color + '50', backgroundColor: color + '08' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>⚠</Text>
                    <Text style={[styles.alertaCiudad, { color }]}>Tu purificador: {a.nombre}</Text>
                    <View style={[styles.alertaBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                      <Text style={[styles.alertaBadgeText, { color }]}>
                        {(a.data.calidad_aire ?? '').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alertaLine}>Gas crítico: <Text style={{ fontWeight: '800' }}>{a.data.gas_critico || '—'}</Text></Text>
                  <Text style={styles.alertaLine}>PM2.5: {(a.data.pm25_ugm3 ?? 0).toFixed(1)} μg/m³ · CO₂: {(a.data.co2_ppm ?? 0).toFixed(0)} ppm · CO: {(a.data.co_ppm ?? 0).toFixed(2)} ppm</Text>
                  <Text style={styles.alertaLine}>Umbral PM2.5: {umbralPM25} μg/m³ · CO₂: {umbralCO2} ppm</Text>
                  <View style={[styles.recomBox, { backgroundColor: color + '12', borderColor: color + '30' }]}>
                    <Text style={[styles.recomText, { color }]}>
                      {(a.data.calidad_aire ?? '').toLowerCase() === 'peligroso'
                        ? '🚨 Evite salir. Encienda el purificador. Consulte al médico si hay síntomas.'
                        : '⚠ Reduzca actividades al aire libre. Ventile el espacio con precaución.'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Todo bien */}
        {listaDispositivos.length > 0 && alertasActivas.length === 0 && (
          <View style={styles.okCard}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>✓</Text>
            <Text style={styles.okTitle}>Todo en orden</Text>
            <Text style={styles.okSub}>Todos tus purificadores dentro de rangos seguros.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:       { flex: 1, backgroundColor: '#f5f5f5' },
  container:      { padding: 16, paddingBottom: 40 },
  toggleCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, elevation: 2 },
  toggleTitle:    { fontSize: 15, fontWeight: '700', color: '#333' },
  toggleSub:      { fontSize: 12, color: '#aaa', marginTop: 2 },
  sectionTitle:   { fontSize: 15, fontWeight: 'bold', color: '#333', marginVertical: 12 },
  umbralesRow:    { flexDirection: 'row', gap: 12, marginBottom: 6 },
  umbralCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', elevation: 2 },
  umbralGas:      { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  umbralControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  umbralBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  umbralBtnText:  { fontSize: 18, color: '#333', lineHeight: 20 },
  umbralValue:    { fontSize: 20, fontWeight: '900', color: '#333', minWidth: 50, textAlign: 'center' },
  umbralUnit:     { fontSize: 10, color: '#aaa', marginTop: 6 },
  ciudadCard:     { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, elevation: 1, gap: 10 },
  dot:            { width: 10, height: 10, borderRadius: 5 },
  ciudadLabel:    { fontSize: 14, fontWeight: '700', color: '#333' },
  ciudadGases:    { fontSize: 11, color: '#888', marginTop: 2 },
  aqiBadge:       { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  aqiBadgeText:   { fontSize: 10, fontWeight: '800' },
  emptyCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', elevation: 1 },
  emptyText:      { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 6 },
  emptyDesc:      { fontSize: 12, color: '#aaa', textAlign: 'center' },
  alertaCard:     { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 12, elevation: 2 },
  alertaCiudad:   { fontSize: 14, fontWeight: '900', flex: 1 },
  alertaBadge:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  alertaBadgeText:{ fontSize: 10, fontWeight: '800' },
  alertaLine:     { fontSize: 12, color: '#555', marginBottom: 4 },
  recomBox:       { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 8 },
  recomText:      { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  okCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', elevation: 2, marginTop: 16, borderWidth: 1, borderColor: '#4CAF5030' },
  okTitle:        { fontSize: 18, fontWeight: '800', color: '#4CAF50', marginBottom: 6 },
  okSub:          { fontSize: 13, color: '#888', textAlign: 'center' },
});
