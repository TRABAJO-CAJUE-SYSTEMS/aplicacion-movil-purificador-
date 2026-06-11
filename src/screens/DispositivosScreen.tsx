import React, { useEffect, useState } from 'react';
import ConfigWizard from './ConfigWizardNew';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { database, ref, onValue, set, auth } from '../firebaseConfig';

interface Dispositivo {
  id: string;
  nombre: string;
  ciudad: string;
  calidad_aire: string;
  co2_ppm: number;
  co_ppm: number;
  extractor: string;
  modo: string;
  latitud?: number;
  longitud?: number;
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
  if (v === 'bueno')     return 'Saludable';
  if (v === 'moderado')  return 'Precaución';
  if (v === 'peligroso') return 'Peligroso';
  return 'Sin datos';
}

function DispositivoCard({
  d, uid, onToggleExtractor, onToggleModo,
  optimisticExt, optimisticModo,
}: {
  d: Dispositivo; uid: string;
  onToggleExtractor: (deviceId: string, val: boolean) => void;
  onToggleModo: (deviceId: string, val: boolean) => void;
  optimisticExt?: boolean;
  optimisticModo?: boolean;
}) {
  const color    = colorCalidad(d.calidad_aire);
  const extON    = optimisticExt  ?? (d.extractor === 'ON');
  const modoAuto = optimisticModo ?? (d.modo === 'Automatico' || d.modo === 'Automático');

  return (
    <View style={[styles.deviceCard, { borderColor: color + '40' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={[styles.deviceDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>{d.nombre || d.id}</Text>
          <Text style={styles.deviceCiudad}>{d.ciudad || '—'}</Text>
        </View>
        <View style={[styles.aqiBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.aqiBadgeText, { color }]}>{textoSimple(d.calidad_aire)}</Text>
        </View>
      </View>

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

      <View style={styles.controlsRow}>
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>Extractor</Text>
          <Switch value={extON} onValueChange={(v) => onToggleExtractor(d.id, v)}
            trackColor={{ false: '#eee', true: '#00AFAA80' }}
            thumbColor={extON ? '#00AFAA' : '#ccc'}
            ios_backgroundColor="#eee" />
          <Text style={[styles.controlValue, { color: extON ? '#00AFAA' : '#aaa' }]}>
            {extON ? 'ON' : 'OFF'}
          </Text>
        </View>
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>Modo</Text>
          <Switch value={modoAuto} onValueChange={(v) => onToggleModo(d.id, v)}
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

const DispositivosScreen: React.FC = () => {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showWizard,   setShowWizard]   = useState(false);
  const [editDeviceId, setEditDeviceId] = useState<string | null>(null);
  const [optExt,  setOptExt]  = useState<Record<string, boolean>>({});
  const [optModo, setOptModo] = useState<Record<string, boolean>>({});

  const uid = auth.currentUser?.uid ?? '';

  // Escuchar dispositivos/{uid}/ — todos los del usuario
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onValue(ref(database, `dispositivos/${uid}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val() as Record<string, any>;
        const lista: Dispositivo[] = Object.entries(data).map(([deviceId, d]) => ({
          id:    deviceId,
          nombre: d.nombre || deviceId,
          ciudad: d.ciudad || '—',
          calidad_aire:         d.calidad_aire ?? '',
          co2_ppm:              d.co2_ppm ?? 0,
          co_ppm:               d.co_ppm  ?? 0,
          extractor:            d.extractor ?? 'OFF',
          modo:                 d.modo ?? 'Automatico',
          latitud:              d.latitud,
          longitud:             d.longitud,
          ultima_actualizacion: d.ultima_actualizacion,
        }));
        setDispositivos(lista);
        // Limpiar estados optimistas cuando Firebase confirma
        setOptExt({});
        setOptModo({});
      } else {
        setDispositivos([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // Toggle extractor → escribe en control/{uid}/{deviceId}/extractor
  const toggleExtractor = async (deviceId: string, val: boolean) => {
    setOptExt(prev => ({ ...prev, [deviceId]: val }));
    try {
      await set(ref(database, `control/${uid}/${deviceId}/extractor`), val);
    } catch (e: any) {
      setOptExt(prev => { const n = { ...prev }; delete n[deviceId]; return n; });
      Alert.alert('Error', e.message ?? 'No se pudo contactar Firebase');
    }
  };

  // Toggle modo → escribe en control/{uid}/{deviceId}/modo_automatico
  const toggleModo = async (deviceId: string, modoAuto: boolean) => {
    setOptModo(prev => ({ ...prev, [deviceId]: modoAuto }));
    try {
      await set(ref(database, `control/${uid}/${deviceId}/modo_automatico`), modoAuto);
    } catch (e: any) {
      setOptModo(prev => { const n = { ...prev }; delete n[deviceId]; return n; });
      Alert.alert('Error', e.message ?? 'No se pudo contactar Firebase');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Dispositivos" />

      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditDeviceId(null); setShowWizard(true); }}>
          <Text style={styles.addBtnText}>＋ Agregar purificador</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007F7A" />
          <Text style={{ color: '#aaa', marginTop: 10 }}>Conectando...</Text>
        </View>
      ) : (
        <FlatList
          data={dispositivos.sort((a, b) => a.nombre.localeCompare(b.nombre))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
              <Text style={{ fontSize: 15, color: '#555', fontWeight: '800', marginBottom: 8 }}>
                Sin purificadores registrados
              </Text>
              <Text style={{ fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
                Agrega tu primer purificador conectándote vía Bluetooth.
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
            <View>
              <DispositivoCard
                d={item}
                uid={uid}
                onToggleExtractor={toggleExtractor}
                onToggleModo={toggleModo}
                optimisticExt={optExt[item.id]}
                optimisticModo={optModo[item.id]}
              />
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => { setEditDeviceId(item.id); setShowWizard(true); }}
              >
                <Text style={styles.editBtnText}>⚙ Reconfigurar por Bluetooth</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showWizard} animationType="slide" onRequestClose={() => setShowWizard(false)}>
        <ConfigWizard
          onClose={() => { setShowWizard(false); setEditDeviceId(null); }}
          existingDeviceId={editDeviceId ?? undefined}
        />
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
  editBtn:       { marginTop: -10, marginBottom: 14, paddingVertical: 9, alignItems: 'center', backgroundColor: '#f0fffe', borderRadius: 10, borderWidth: 1, borderColor: '#00AFAA30' },
  editBtnText:   { fontSize: 12, color: '#007F7A', fontWeight: '700' },
  controlsRow:   { flexDirection: 'row', gap: 16 },
  controlItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlLabel:  { fontSize: 12, color: '#666', fontWeight: '600' },
  controlValue:  { fontSize: 11, fontWeight: '800' },
});
