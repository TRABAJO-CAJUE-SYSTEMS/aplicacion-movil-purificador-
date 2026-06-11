import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, Dimensions, TouchableOpacity, Platform, Linking, Alert,
} from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import Header from '../components/Header';
import { database, ref, onValue, auth } from '../firebaseConfig';
import { aqiColor, AQI_LEVELS } from '../theme';

interface EstacionData {
  calidad_aire?: string;
  co2_ppm?: number;
  pm25_ugm3?: number;
  extractor?: string;
}

interface Candidato { nombre: string; lat: number; lon: number; }
interface Nearest   { nombre: string; lat: number; lon: number; km: number; }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDist(km: number) { return km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`; }
function tiempoCaminando(km: number): string {
  const mins = Math.round((km/5)*60);
  if (mins < 1) return '< 1 min';
  return mins < 60 ? `${mins} min caminando` : `${Math.floor(mins/60)}h ${mins%60}min`;
}

function getMarkerColor(c?: string, pm25?: number): string {
  if (pm25 != null && pm25 > 0) {
    if (pm25 <= 12)  return AQI_LEVELS.bueno.color;
    if (pm25 <= 35)  return AQI_LEVELS.moderado.color;
    if (pm25 <= 55)  return AQI_LEVELS.insalubre_sensibles.color;
    if (pm25 <= 150) return AQI_LEVELS.insalubre.color;
    if (pm25 <= 250) return AQI_LEVELS.muy_insalubre.color;
    return AQI_LEVELS.peligroso.color;
  }
  return aqiColor(c ?? '') || '#9E9E9E';
}

const ESTACIONES_BASE: Candidato[] = [
  { nombre: 'Estación Cochabamba', lat: -17.3935, lon: -66.1570 },
  { nombre: 'Estación La Paz',     lat: -16.5000, lon: -68.1500 },
  { nombre: 'Estación Santa Cruz', lat: -17.7833, lon: -63.1821 },
];

const MapaScreen: React.FC = () => {
  const [loading,     setLoading]     = useState(true);
  const [estaciones,  setEstaciones]  = useState<(Candidato & { id: string; data?: EstacionData })[]>([]);
  const [candidatos,  setCandidatos]  = useState<Candidato[]>(ESTACIONES_BASE);
  const [userLoc,     setUserLoc]     = useState<{ lat: number; lon: number } | null>(null);
  const [nearest,     setNearest]     = useState<Nearest | null>(null);
  const [searching,   setSearching]   = useState(false);
  const mapRef = useRef<MapView>(null);

  // Cargar dispositivos del usuario desde dispositivos/{uid}/
  useEffect(() => {
    const uid = auth.currentUser?.uid ?? '';
    if (!uid) { setLoading(false); return; }

    const unsub = onValue(ref(database, `dispositivos/${uid}`), (snap) => {
      if (snap.exists()) {
        const results: (Candidato & { id: string; data?: EstacionData })[] = [];
        Object.entries(snap.val() as Record<string, any>).forEach(([id, d]) => {
          results.push({
            id,
            nombre: d.nombre || id,
            lat: d.latitud  ?? -17.3935,
            lon: d.longitud ?? -66.1570,
            data: d,
          });
        });
        setEstaciones(results);
        setCandidatos(results);
      } else {
        setEstaciones([]);
        setCandidatos(ESTACIONES_BASE);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleFindNearest = async () => {
    setSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa la ubicación en los Ajustes del sistema.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lon } = loc.coords;
      setUserLoc({ lat, lon });

      if (candidatos.length === 0) {
        Alert.alert('Sin estaciones', 'No hay estaciones disponibles aún.');
        return;
      }
      let mejor = candidatos[0];
      let minDist = haversineKm(lat, lon, candidatos[0].lat, candidatos[0].lon);
      candidatos.forEach((c) => {
        const d = haversineKm(lat, lon, c.lat, c.lon);
        if (d < minDist) { minDist = d; mejor = c; }
      });
      setNearest({ nombre: mejor.nombre, lat: mejor.lat, lon: mejor.lon, km: minDist });
      mapRef.current?.animateToRegion({ latitude: mejor.lat, longitude: mejor.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 1200);
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación.');
    } finally {
      setSearching(false);
    }
  };

  const handleComoLlegar = () => {
    if (!nearest) return;
    const url = Platform.OS === 'ios'
      ? `maps:0,0?q=${nearest.lat},${nearest.lon}`
      : `geo:${nearest.lat},${nearest.lon}?q=${nearest.lat},${nearest.lon}`;
    Linking.canOpenURL(url).then((can) => {
      Linking.openURL(can ? url : `https://www.google.com/maps/dir/?api=1&destination=${nearest.lat},${nearest.lon}`);
    });
  };

  return (
    <View style={styles.container}>
      <Header title="Mapa" />

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007F7A" /></View>
      ) : (
        <>
          {/* Botón buscar cercano */}
          <TouchableOpacity style={styles.findBtn} onPress={handleFindNearest} disabled={searching}>
            <Text style={styles.findBtnText}>
              {searching ? '🔍 Buscando...' : '📍 Purificador más cercano'}
            </Text>
          </TouchableOpacity>

          {/* Resultado */}
          {nearest && (
            <View style={styles.nearestCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nearestName}>{nearest.nombre}</Text>
                <Text style={styles.nearestDist}>
                  {formatDist(nearest.km)} · {tiempoCaminando(nearest.km)}
                </Text>
              </View>
              <TouchableOpacity style={styles.goBtn} onPress={handleComoLlegar}>
                <Text style={styles.goBtnText}>🗺️ Ir</Text>
              </TouchableOpacity>
            </View>
          )}

          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{ latitude: -17.0, longitude: -66.5, latitudeDelta: 4, longitudeDelta: 4 }}
            showsUserLocation
          >
            {estaciones.map((e) => {
              const color = getMarkerColor(e.data?.calidad_aire, e.data?.pm25_ugm3);
              return (
                <React.Fragment key={e.id}>
                  <Marker coordinate={{ latitude: e.lat, longitude: e.lon }}>
                    <View style={[styles.marker, { backgroundColor: color }]}>
                      <Text style={styles.markerText}>
                        {(e.data?.calidad_aire ?? '?').slice(0, 3).toUpperCase()}
                      </Text>
                    </View>
                    <Callout>
                      <View style={styles.callout}>
                        <Text style={styles.calloutTitle}>{e.nombre}</Text>
                        {e.data?.pm25_ugm3 != null && e.data.pm25_ugm3 > 0 && (
                          <Text style={[styles.calloutText, { fontWeight: '700', color: getMarkerColor(e.data.calidad_aire, e.data.pm25_ugm3) }]}>
                            PM2.5: {e.data.pm25_ugm3.toFixed(1)} μg/m³
                          </Text>
                        )}
                        <Text style={styles.calloutText}>
                          {e.data?.calidad_aire
                            ? `${e.data.calidad_aire.charAt(0).toUpperCase()}${e.data.calidad_aire.slice(1)} · CO₂: ${(e.data.co2_ppm ?? 0).toFixed(0)} ppm`
                            : 'Sin datos'}
                        </Text>
                        {e.data?.extractor && (
                          <Text style={styles.calloutText}>Extractor: {e.data.extractor}</Text>
                        )}
                      </View>
                    </Callout>
                  </Marker>
                  {e.data && (
                    <Circle center={{ latitude: e.lat, longitude: e.lon }}
                      radius={15000} strokeColor={color} fillColor={color + '12'} strokeWidth={1.5} />
                  )}
                </React.Fragment>
              );
            })}

            {userLoc && (
              <Marker coordinate={{ latitude: userLoc.lat, longitude: userLoc.lon }} title="Tu ubicación">
                <View style={styles.userMarker} />
              </Marker>
            )}
          </MapView>

          <ScrollView horizontal contentContainerStyle={styles.legendContainer} showsHorizontalScrollIndicator={false}>
            {([
              ...Object.entries(AQI_LEVELS).map(([, v]) => ({ color: v.color, label: v.label, range: v.range })),
              { color: '#9E9E9E', label: 'Sin datos', range: '' },
            ]).map(({ color, label, range }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: color }]} />
                <View>
                  <Text style={styles.legendText}>{label}</Text>
                  {!!range && <Text style={styles.legendRange}>{range}</Text>}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default MapaScreen;

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center' },
  findBtn:         { margin: 12, backgroundColor: '#007F7A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  findBtnText:     { color: '#fff', fontWeight: '800', fontSize: 14 },
  nearestCard:     { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#00AFAA15', borderRadius: 12, borderWidth: 1, borderColor: '#00AFAA40', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  nearestName:     { fontSize: 13, fontWeight: '800', color: '#333' },
  nearestDist:     { fontSize: 12, color: '#007F7A', fontWeight: '600', marginTop: 2 },
  goBtn:           { backgroundColor: '#007F7A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  goBtnText:       { color: '#fff', fontWeight: '800', fontSize: 13 },
  map:             { width: '100%', height: Dimensions.get('window').height * 0.45 },
  marker:          { padding: 6, borderRadius: 20, borderColor: '#fff', borderWidth: 2 },
  markerText:      { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  userMarker:      { width: 14, height: 14, borderRadius: 7, backgroundColor: '#2196F3', borderWidth: 2, borderColor: '#fff' },
  callout:         { width: 160 },
  calloutTitle:    { fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  calloutText:     { fontSize: 12, color: '#555' },
  legendContainer: { padding: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendColor:     { width: 14, height: 14, borderRadius: 3 },
  legendText:      { fontSize: 11, color: '#333', fontWeight: '700' },
  legendRange:     { fontSize: 9, color: '#888' },
});
