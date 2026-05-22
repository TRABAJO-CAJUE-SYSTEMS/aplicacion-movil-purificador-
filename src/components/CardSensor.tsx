import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CardSensorProps {
  title: string;
  value: number | string;
  unit?: string;
  status: string;
  colorStart: string;
  colorEnd: string;
}

export default function CardSensor({
  title,
  value,
  unit = '',
  status,
  colorStart,
  colorEnd,
}: CardSensorProps) {
  return (
    <View style={[styles.card, { backgroundColor: colorStart }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>
        {value} {unit}
      </Text>
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: colorEnd }]} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#007F7A',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#555',
  },
});
