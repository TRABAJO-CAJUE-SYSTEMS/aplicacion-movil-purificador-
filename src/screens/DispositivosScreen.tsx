import React, { useEffect, useState } from 'react';
import ConfigWizard from './ConfigWizardNew';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, Switch,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import Header from '../components/Header';
import { database, ref, onValue, set } from '../firebaseConfig';

// ── Tipos ──────────────────────────────────────────────────
interface Dispositivo {
  id: string;           // clave Firebase
  nombre: string;
  ciudad: string;
  calidad_aire: string;
  co2_ppm: number;
  co_ppm: number;
  extractor: string;    // "ON" | "OFF"
  modo: string;         // "Automatico" | "Manual"
  latitud?: number;
  longitud?: number;
  ultima_actualizacion?: string;
}

const CIUDADES = ['cochabamba', 'la_paz', 'santa_cruz'];
const LABEL_CIUDAD: Record<string, string> = {
  cochabamba: 'Cochabamba', la_paz: 'La Paz', santa_cruz: 'Santa Cruz',
};

function colorCalidad(c: string) {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return '#4CAF50';
  if (v === 'moderado')  return '#FF9800';
  if (v === 'peligroso') return '#F44336';
  return '#aaa';
}
function textoSimple(c: string) {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return 'Saludable';
  if (v === 'moderado')  return 'Precaución';
  if (v === 'peligroso') return 'Peligroso';
  return 'Sin datos';
}

// ── Card de dispositivo ────────────────────────────────────
function DispositivoCard({
  d, onToggleExtractor, onToggleModo,
  optimisticExt, optimisticModo,
}: {
  d: Dispositivo;
  onToggleExtractor: (ciudad: string, val: boolean) => void;
  onToggleModo: (ciudad: string, val: boolean) => void;
  optimisticExt?: boolean;
  optimisticModo?: boolean;
}) {
  const color = colorCalidad(d.calidad_aire);
  // Estado optimista: muestra el valor local inmediatamente mientras Firebase confirma
  const extON    = optimisticExt  ?? (d.extractor === 'ON');
  const modoAuto = optimisticModo ?? (d.modo === 'Automatico' || d.modo === 'Automático');
  // Fallback de nombre → usa la etiqueta de ciudad si no hay nombre personalizado
  const nombre = d.nombre || LABEL_CIUDAD[d.ciudad] || d.ciudad;

  return (
    <View style={[styles.deviceCard, { borderColor: color + '40' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={[styles.deviceDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>{nombre}</Text>
          <Text style={styles.deviceCiudad}>{LABEL_CIUDAD[d.ciudad] ?? d.ciudad}</Text>
        </View>
        <View style={[styles.aqiBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.aqiBadgeText, { color }]}>{textoSimple(d.calidad_aire)}</Text>
        </View>
      </View>

      {/* Gases */}
      <View style={styles.gasesRow}>
        {[
          { label: 'CO₂', value: d.co2_ppm, color: '#818cf8' },
          { label: 'CO',  value: d.co_ppm,  color: '#f97316' },
        ].map(({ label, value, color: c }) => (
          <View key={label} style={styles.gasChip}>
            <Text style={[styles.gasChipLabel, { color: c }]}>{label}</Text>
            <Text style={styles.gasChipValue}>{(value ?? 0).toFixed(label === 'CO' ? 2 : 0)} ppm</Text>
          </View>
        ))}
        {d.ultima_actualizacion && (
          <Text style={styles.updateTime} numberOfLines={1}>
            {d.ultima_actualizacion.split(' ')[1] ?? ''}
          </Text>
        )}
      </View>

      {/* Controles */}
      <View style={styles.controlsRow}>
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>Extractor</Text>
          <Switch value={extON} onValueChange={(v) => onToggleExtractor(d.ciudad, v)}
            trackColor={{ false: '#eee', true: '#00AFAA80' }}
            thumbColor={extON ? '#00AFAA' : '#ccc'}
            ios_backgroundColor="#eee" />
          <Text style={[styles.controlValue, { color: extON ? '#00AFAA' : '#aaa' }]}>
            {extON ? 'ON' : 'OFF'}
          </Text>
        </View>
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>Modo</Text>
          <Switch value={modoAuto} onValueChange={(v) => onToggleModo(d.ciudad, v)}
            trackColor={{ false: '#f97316', true: '#00AFAA80' }}
            thumbColor={modoAuto ? '#00AFAA' : '#f97316'}
            ios_backgroundColor="#f97316" />
          <Text style={[styles.controlValue, { color: modoAuto ? '#00AFAA' : '#f97316' }]}>
            {modoAuto ? 'Auto' : 'Manual'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Wizard de configuración (BLE / WiFi AP) ───────────────
type WizardStep = 'intro' | 'buscando' | 'encontrado' | 'credenciales' | 'enviando' | 'exito';

const DispositivosScreen: React.FC = () => {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showWizard,   setShowWizard]   = useState(false);
  // Estado optimista: refleja el toggle inmediatamente en la UI sin esperar al ESP32
  const [optExt,  setOptExt]  = useState<Record<string, boolean>>({});
  const [optModo, setOptModo] = useState<Record<string, boolean>>({});

  // Cargar estado actual desde /dispositivos/*
  useEffect(() => {
    let loadCount = 0;
    const unsubs = CIUDADES.map((c) =>
      onValue(ref(database, `dispositivos/${c}`), (snap) => {
        loadCount++;
        if (snap.exists()) {
          const data = snap.val();
          setDispositivos((prev) => {
            const filtered = prev.filter((d) => d.ciudad !== c);
            return [...filtered, {
              id: c,
              ciudad: c,
              nombre: data.nombre || data.ciudad || LABEL_CIUDAD[c] || c,
              ...data,
            }];
          });
          // Limpiar estado optimista cuando Firebase confirma el nuevo valor
          setOptExt(prev => { const n = { ...prev }; delete n[c]; return n; });
          setOptModo(prev => { const n = { ...prev }; delete n[c]; return n; });
        }
        if (loadCount >= CIUDADES.length) setLoading(false);
      })
    );
    return () => unsubs.forEach((fn) => fn());
  }, []);

  // Control remoto: toggle extractor
  const toggleExtractor = async (ciudad: string, val: boolean) => {
    // Optimistic update: actualiza la UI ANTES de la respuesta de Firebase
    setOptExt(prev => ({ ...prev, [ciudad]: val }));
    try {
      await set(ref(database, `control/${ciudad}/extractor`), val);
    } catch (e: any) {
      // Revertir si falla
      setOptExt(prev => { const n = { ...prev }; delete n[ciudad]; return n; });
      Alert.alert('Error al enviar comando', e.message ?? 'No se pudo contactar Firebase');
    }
  };

  // Control remoto: modo automático / manual
  const toggleModo = async (ciudad: string, modoAuto: boolean) => {
    setOptModo(prev => ({ ...prev, [ciudad]: modoAuto }));
    try {
      await set(ref(database, `control/${ciudad}/modo_automatico`), modoAuto);
    } catch (e: any) {
      setOptModo(prev => { const n = { ...prev }; delete n[ciudad]; return n; });
      Alert.alert('Error al enviar comando', e.message ?? 'No se pudo contactar Firebase');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Dispositivos" />

      {/* Botón agregar purificador */}
      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowWizard(true)}>
          <Text style={styles.addBtnText}>＋ Agregar purificador</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007F7A" />
          <Text style={{ color: '#aaa', marginTop: 10 }}>Conectando a Firebase...</Text>
        </View>
      ) : (
        <FlatList
          data={dispositivos.sort((a, b) => a.ciudad.localeCompare(b.ciudad))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
              <Text style={{ fontSize: 15, color: '#555', fontWeight: '800', marginBottom: 8 }}>
                Sin dispositivos registrados
              </Text>
              <Text style={{ fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
                Los purificadores aparecen aquí cuando el ESP32 está conectado a Firebase y envía datos a{' '}
                <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>dispositivos/cochabamba</Text>.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#007F7A20', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: '#007F7A50' }}
                onPress={() => setShowWizard(true)}
              >
                <Text style={{ color: '#007F7A', fontWeight: '800' }}>＋ Configurar purificador nuevo</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <DispositivoCard
              d={item}
              onToggleExtractor={toggleExtractor}
              onToggleModo={toggleModo}
              optimisticExt={optExt[item.ciudad]}
              optimisticModo={optModo[item.ciudad]}
            />
          )}
        />
      )}

      {/* Wizard modal */}
      <Modal visible={showWizard} animationType="slide" onRequestClose={() => setShowWizard(false)}>
        <ConfigWizard onClose={() => setShowWizard(false)} />
      </Modal>
    </SafeAreaView>
  );
};

export default DispositivosScreen;

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#f5f5f5' },
  addRow:        { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  addBtn:        { backgroundColor: '#007F7A', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  addBtnText:    { color: '#fff', fontWeight: '800', fontSize: 14 },
  // ── Device Card ──
  deviceCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, borderWidth: 1 },
  deviceDot:     { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  deviceName:    { fontSize: 15, fontWeight: '800', color: '#333' },
  deviceCiudad:  { fontSize: 12, color: '#aaa', marginTop: 1 },
  aqiBadge:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  aqiBadgeText:  { fontSize: 11, fontWeight: '800' },
  gasesRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  gasChip:       { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  gasChipLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  gasChipValue:  { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 1 },
  updateTime:    { flex: 1, textAlign: 'right', fontSize: 10, color: '#bbb' },
  controlsRow:   { flexDirection: 'row', gap: 16 },
  controlItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlLabel:  { fontSize: 12, color: '#666', fontWeight: '600' },
  controlValue:  { fontSize: 11, fontWeight: '800' },
  // ── Wizard ──
  wizardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  wizardTitle:   { fontSize: 17, fontWeight: '900', color: '#333' },
  wizCenter:     { alignItems: 'center', paddingTop: 20, gap: 14 },
  wizCheckCircle:{ width: 72, height: 72, borderRadius: 22, backgroundColor: '#00AFAA15', borderWidth: 1.5, borderColor: '#00AFAA40', alignItems: 'center', justifyContent: 'center' },
  wizStepCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 1 },
  wizStepNum:    { fontSize: 10, fontWeight: '800', color: '#aaa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  wizStepTitle:  { fontSize: 20, fontWeight: '900', color: '#333', marginBottom: 10, textAlign: 'center' },
  wizStepDesc:   { fontSize: 14, color: '#555', lineHeight: 22, textAlign: 'center' },
  wizHintRow:    { gap: 8, marginTop: 16 },
  wizHint:       { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10 },
  wizHintText:   { fontSize: 13, color: '#555' },
  wizHintBox:    { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', borderWidth: 1, borderColor: '#eee' },
  wizHintBoxTitle:{ fontSize: 12, fontWeight: '800', color: '#333', marginBottom: 6 },
  wizHintBoxDesc: { fontSize: 13, color: '#555', lineHeight: 20 },
  wizFormCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  wizFieldLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
  wizInput:      { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#eee', marginBottom: 12 },
  ciudadBtn:     { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#eee' },
  ciudadBtnActive:{ backgroundColor: '#00AFAA15', borderColor: '#00AFAA' },
  ciudadBtnText: { fontSize: 12, color: '#666' },
  wizSummary:    { backgroundColor: '#f5f5f5', borderRadius: 14, padding: 14, width: '100%', gap: 10 },
  wizSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wizSummaryLabel:{ fontSize: 13, color: '#666' },
  wizSummaryValue:{ fontSize: 13, fontWeight: '700', color: '#333' },
  wizBtn:        { backgroundColor: '#007F7A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', width: '100%', marginTop: 8, elevation: 2 },
  wizBtnText:    { color: '#fff', fontWeight: '800', fontSize: 15 },
});
