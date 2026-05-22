import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import { database, ref, onValue } from '../firebaseConfig';
import { aqiColor, aqiLabel, aqiFromPM25, AQI_LEVELS } from '../theme';

const STORAGE_KEY = 'zonas_interes_v1';

interface Zona {
  id:     string;
  nombre: string;
  lat:    number;
  lon:    number;
  icono:  string;
}

interface EstacionAQI {
  id:           string;
  lat:          number;
  lon:          number;
  calidad_aire?: string;
  pm25_ugm3?:   number;
  co2_ppm?:     number;
}

const ESTACIONES_BASE: EstacionAQI[] = [
  { id: 'cochabamba', lat: -17.3935, lon: -66.1570 },
  { id: 'la_paz',     lat: -16.5000, lon: -68.1500 },
  { id: 'santa_cruz', lat: -17.7833, lon: -63.1821 },
];

const ICONOS = ['🏠', '🏢', '🏫', '🏥', '🌳', '⭐', '📍', '🏋️'];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCalidadForZona(zona: Zona, estaciones: EstacionAQI[]): { calidad: string; pm25?: number; distKm: number } {
  if (estaciones.length === 0) return { calidad: '', distKm: 0 };
  let best = estaciones[0];
  let minDist = haversineKm(zona.lat, zona.lon, estaciones[0].lat, estaciones[0].lon);
  estaciones.forEach(e => {
    const d = haversineKm(zona.lat, zona.lon, e.lat, e.lon);
    if (d < minDist) { minDist = d; best = e; }
  });
  const calidad = best.pm25_ugm3 && best.pm25_ugm3 > 0
    ? aqiFromPM25(best.pm25_ugm3)
    : (best.calidad_aire ?? '');
  return { calidad, pm25: best.pm25_ugm3, distKm: minDist };
}

const ZonasInteresScreen: React.FC = () => {
  const [zonas,      setZonas]      = useState<Zona[]>([]);
  const [estaciones, setEstaciones] = useState<EstacionAQI[]>(ESTACIONES_BASE);
  const [userLoc,    setUserLoc]    = useState<{ lat: number; lon: number } | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [locating,   setLocating]   = useState(false);
  // Formulario nueva zona
  const [nombre,    setNombre]    = useState('');
  const [icono,     setIcono]     = useState('📍');
  const [pendingLat,setPendingLat]= useState<number | null>(null);
  const [pendingLon,setPendingLon]= useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  // Cargar zonas guardadas
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try { setZonas(JSON.parse(raw)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Guardar zonas cuando cambian
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(zonas));
  }, [zonas]);

  // Suscribirse a datos AQI de estaciones Firebase
  useEffect(() => {
    const ids = ['cochabamba', 'la_paz', 'santa_cruz'];
    const unsubs = ids.map(id =>
      onValue(ref(database, `dispositivos/${id}`), snap => {
        if (!snap.exists()) return;
        const d = snap.val();
        setEstaciones(prev => prev.map(e =>
          e.id === id ? { ...e, calidad_aire: d.calidad_aire, pm25_ugm3: d.pm25_ugm3, co2_ppm: d.co2_ppm } : e
        ));
      })
    );
    return () => unsubs.forEach(fn => fn());
  }, []);

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado', 'Activa la ubicación en Ajustes.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lon } = loc.coords;
      setUserLoc({ lat, lon });
      setPendingLat(lat);
      setPendingLon(lon);
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);
      setModalOpen(true);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLocating(false);
    }
  };

  const handleAgregarZona = () => {
    if (!nombre.trim() || pendingLat == null || pendingLon == null) {
      Alert.alert('Completa el nombre y ubícate en el mapa');
      return;
    }
    const nueva: Zona = {
      id:     Date.now().toString(),
      nombre: nombre.trim(),
      lat:    pendingLat,
      lon:    pendingLon,
      icono,
    };
    setZonas(prev => [...prev, nueva]);
    setNombre('');
    setIcono('📍');
    setPendingLat(null);
    setPendingLon(null);
    setModalOpen(false);
  };

  const handleEliminar = (id: string) => {
    Alert.alert('Eliminar zona', '¿Deseas eliminar esta zona de interés?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setZonas(prev => prev.filter(z => z.id !== id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Zonas de Interés" />
      <ScrollView contentContainerStyle={styles.container}>

        {/* Mapa */}
        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{ latitude: -17.3935, longitude: -66.1570, latitudeDelta: 3, longitudeDelta: 3 }}
            showsUserLocation
            onLongPress={e => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setPendingLat(latitude);
              setPendingLon(longitude);
              setModalOpen(true);
            }}
          >
            {zonas.map(z => {
              const { calidad } = getCalidadForZona(z, estaciones);
              const color = aqiColor(calidad) || '#9E9E9E';
              return (
                <React.Fragment key={z.id}>
                  <Marker
                    coordinate={{ latitude: z.lat, longitude: z.lon }}
                    title={z.nombre}
                    description={calidad ? aqiLabel(calidad) : 'Sin datos'}
                  >
                    <View style={[styles.zonaMark, { backgroundColor: color + '20', borderColor: color }]}>
                      <Text style={styles.zonaMarkIcon}>{z.icono}</Text>
                    </View>
                  </Marker>
                  {calidad && (
                    <Circle
                      center={{ latitude: z.lat, longitude: z.lon }}
                      radius={8000}
                      strokeColor={color}
                      fillColor={color + '10'}
                      strokeWidth={1}
                    />
                  )}
                </React.Fragment>
              );
            })}
            {pendingLat != null && pendingLon != null && (
              <Marker coordinate={{ latitude: pendingLat, longitude: pendingLon }} pinColor="#00C9BE" />
            )}
          </MapView>
          <Text style={styles.mapHint}>Mantén presionado el mapa para agregar una zona</Text>
        </View>

        {/* Botón agregar por GPS */}
        <TouchableOpacity style={styles.addBtn} onPress={handleGetLocation} disabled={locating}>
          {locating
            ? <ActivityIndicator color="#00C9BE" size="small" />
            : <Text style={styles.addBtnText}>📍  Agregar mi ubicación actual</Text>
          }
        </TouchableOpacity>

        {/* Lista de zonas */}
        <Text style={styles.sectionTitle}>
          {zonas.length === 0 ? 'Sin zonas guardadas' : `${zonas.length} zona${zonas.length > 1 ? 's' : ''} guardada${zonas.length > 1 ? 's' : ''}`}
        </Text>

        {zonas.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🗺️</Text>
            <Text style={styles.emptyTitle}>Agrega zonas de interés</Text>
            <Text style={styles.emptyDesc}>
              Guarda ubicaciones importantes (casa, trabajo, escuela) para monitorear la calidad del aire en esos lugares específicos.
            </Text>
          </View>
        ) : (
          zonas.map(z => {
            const { calidad, pm25, distKm } = getCalidadForZona(z, estaciones);
            const color = aqiColor(calidad) || '#9E9E9E';
            return (
              <View key={z.id} style={[styles.zonaCard, { borderColor: color + '40' }]}>
                <View style={[styles.zonaIconBox, { backgroundColor: color + '15' }]}>
                  <Text style={styles.zonaIcon}>{z.icono}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zonaNombre}>{z.nombre}</Text>
                  <Text style={styles.zonaSub}>
                    {pm25 != null && pm25 > 0
                      ? `PM2.5: ${pm25.toFixed(1)} μg/m³ · Estación a ${distKm.toFixed(0)} km`
                      : `Estación más cercana a ${distKm.toFixed(0)} km`}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[styles.aqiBadge, { backgroundColor: color + '15' }]}>
                    <Text style={[styles.aqiBadgeText, { color }]}>
                      {calidad ? aqiLabel(calidad) : 'Sin datos'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleEliminar(z.id)}>
                    <Text style={styles.deleteText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Leyenda AQI */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Escala AQI</Text>
          {Object.entries(AQI_LEVELS).map(([, v]) => (
            <View key={v.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: v.color }]} />
              <Text style={styles.legendLabel}>{v.label}</Text>
              <Text style={styles.legendRange}>{v.range}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal nueva zona */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva zona de interés</Text>
            <Text style={styles.modalSub}>
              {pendingLat != null ? `📍 ${pendingLat?.toFixed(5)}, ${pendingLon?.toFixed(5)}` : 'Ubicación no seleccionada'}
            </Text>

            {/* Selector de ícono */}
            <View style={styles.iconRow}>
              {ICONOS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBtn, icono === ic && styles.iconBtnActive]}
                  onPress={() => setIcono(ic)}
                >
                  <Text style={{ fontSize: 22 }}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre de la zona (ej: Mi casa)"
              placeholderTextColor="#aaa"
              maxLength={40}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setModalOpen(false); setPendingLat(null); setPendingLon(null); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAgregarZona} disabled={!nombre.trim()}>
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ZonasInteresScreen;

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#f5f5f5' },
  container:     { padding: 16, paddingBottom: 40 },
  mapCard:       { borderRadius: 16, overflow: 'hidden', marginBottom: 12, elevation: 2 },
  map:           { width: '100%', height: 240 },
  mapHint:       { backgroundColor: '#fff', padding: 8, textAlign: 'center', fontSize: 11, color: '#888' },
  addBtn:        { backgroundColor: '#00C9BE20', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#00C9BE50', marginBottom: 16 },
  addBtnText:    { color: '#00C9BE', fontWeight: '800', fontSize: 14 },
  sectionTitle:  { fontSize: 13, fontWeight: '800', color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  emptyCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#eee' },
  emptyTitle:    { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 8 },
  emptyDesc:     { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
  zonaCard:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, elevation: 1, gap: 12 },
  zonaIconBox:   { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  zonaIcon:      { fontSize: 24 },
  zonaNombre:    { fontSize: 14, fontWeight: '800', color: '#333' },
  zonaSub:       { fontSize: 11, color: '#888', marginTop: 2 },
  aqiBadge:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  aqiBadgeText:  { fontSize: 10, fontWeight: '800' },
  deleteText:    { fontSize: 11, color: '#F44336', fontWeight: '700' },
  // Mapa marcadores
  zonaMark:      { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  zonaMarkIcon:  { fontSize: 20 },
  // Leyenda
  legendCard:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 8, elevation: 1 },
  legendTitle:   { fontSize: 12, fontWeight: '800', color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  legendRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  legendDot:     { width: 12, height: 12, borderRadius: 6 },
  legendLabel:   { fontSize: 12, fontWeight: '700', color: '#333', flex: 1 },
  legendRange:   { fontSize: 11, color: '#888' },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:    { fontSize: 18, fontWeight: '900', color: '#333', marginBottom: 4 },
  modalSub:      { fontSize: 12, color: '#888', marginBottom: 16 },
  iconRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  iconBtn:       { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  iconBtnActive: { backgroundColor: '#00C9BE20', borderColor: '#00C9BE' },
  modalInput:    { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#ddd', marginBottom: 16 },
  modalBtns:     { flexDirection: 'row', gap: 10 },
  modalCancelBtn:{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalCancelText:{ color: '#888', fontWeight: '700' },
  modalConfirmBtn:{ flex: 1, backgroundColor: '#00C9BE', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText:{ color: '#fff', fontWeight: '900' },
});
