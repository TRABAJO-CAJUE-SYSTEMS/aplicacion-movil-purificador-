import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Linking,
  Button,
} from 'react-native';
import Header from '../components/Header';
import MapView, { Marker } from 'react-native-maps';

interface AirData {
  city: string;
  country: string;
  location: {
    coordinates: [number, number];
  };
  current: {
    pollution: {
      aqius: number;
      mainus: string;
    };
    weather: {
      tp: number;
      hu: number;
      ws: number;
    };
  };
}

const ZonasScreen: React.FC = () => {
  const [airData, setAirData] = useState<AirData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [region, setRegion] = useState({
    latitude: -17.3895,
    longitude: -66.1568,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const fetchAirQuality = async () => {
    try {
      const response = await fetch(
        'https://api.airvisual.com/v2/nearest_city?lat=-17.3895&lon=-66.1568&key=0f7c0615-beec-4bf5-98a2-e8ce3e1162a4'
      );
      const data = await response.json();
      if (data.status === 'success') {
        setAirData(data.data);
        setError(null);
        setRegion({
          latitude: data.data.location.coordinates[1],
          longitude: data.data.location.coordinates[0],
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } else {
        setError('No se pudo obtener datos de calidad del aire.');
      }
    } catch {
      setError('Sin conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirQuality();
    const interval = setInterval(fetchAirQuality, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Header title="Zonas" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007F7A" />
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: '#F44336', textAlign: 'center', marginHorizontal: 24, fontSize: 15 }}>{error}</Text>
          <Button title="Reintentar" onPress={fetchAirQuality} color="#007F7A" />
        </View>
      ) : !airData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007F7A" />
        </View>
      ) : (
        <>
          <MapView style={styles.map} region={region}>
            <Marker coordinate={region}>
              <View style={styles.marker}>
                <Text style={styles.markerText}>{airData.current.pollution.aqius}</Text>
              </View>
            </Marker>
          </MapView>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.city}>{airData.city}, {airData.country}</Text>
            <Text style={styles.title}>Calidad del Aire</Text>

            <View style={styles.infoBox}>
              <Text style={styles.label}>AQI (US):</Text>
              <Text style={styles.value}>{airData.current.pollution.aqius}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Contaminante Principal:</Text>
              <Text style={styles.value}>{airData.current.pollution.mainus}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Temperatura:</Text>
              <Text style={styles.value}>{airData.current.weather.tp} °C</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Humedad:</Text>
              <Text style={styles.value}>{airData.current.weather.hu} %</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.label}>Velocidad del Viento:</Text>
              <Text style={styles.value}>{airData.current.weather.ws} m/s</Text>
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="📍 Ver en Google Maps"
                color="#007F7A"
                onPress={() => {
                  const lat = region.latitude;
                  const lon = region.longitude;
                  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
                  Linking.openURL(url);
                }}
              />
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default ZonasScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { width: '100%', height: Dimensions.get('window').height * 0.4 },
  scrollContent: { padding: 20 },
  city: { fontSize: 24, fontWeight: 'bold', marginVertical: 10, textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  infoBox: { marginBottom: 15 },
  label: { fontSize: 16, fontWeight: 'bold' },
  value: { fontSize: 16, color: '#555' },
  marker: {
    backgroundColor: '#007F7A',
    padding: 6,
    borderRadius: 20,
    borderColor: '#fff',
    borderWidth: 2,
  },
  markerText: { color: '#fff', fontWeight: 'bold' },
  buttonContainer: {
    marginTop: 20,
    alignSelf: 'center',
    width: '80%',
  },
});