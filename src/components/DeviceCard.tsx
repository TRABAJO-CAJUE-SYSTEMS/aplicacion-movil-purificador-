import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Slider from '@react-native-community/slider';

interface Device {
  nombre: string;
  encendido: boolean;
  modelo: string;
  velocidad: number;
  modo: string;
  calidad_aire: string;
  vida_filtro: number;
}

interface DeviceCardProps {
  device: Device;
  onToggle: (value: boolean) => void;
  onSliderChange: (value: number) => void;
}

export default function DeviceCard({ device, onToggle, onSliderChange }: DeviceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{device.nombre}</Text>
        <Switch value={device.encendido} onValueChange={onToggle} />
      </View>

      <Text style={styles.model}>{device.modelo}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Velocidad: {device.velocidad.toFixed(0)}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={device.velocidad}
          onValueChange={onSliderChange}
          minimumTrackTintColor="#007F7A"
          maximumTrackTintColor="#cccccc"
          thumbTintColor="#007F7A"
        />
      </View>

      <Text style={styles.text}>Modo: {device.modo}</Text>
      <Text style={styles.text}>Calidad del aire: {device.calidad_aire}</Text>
      <Text style={styles.text}>Vida del filtro: {device.vida_filtro}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: 'bold' },
  model: { fontSize: 14, color: '#666', marginBottom: 8 },
  row: { marginVertical: 10 },
  label: { fontSize: 14, marginBottom: 5 },
  slider: { width: '100%', height: 40 },
  text: { fontSize: 14, marginVertical: 2 },
});
