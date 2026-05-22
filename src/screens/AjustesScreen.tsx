import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { auth, database, ref, onValue, set } from '../firebaseConfig';
import { signOut, onAuthStateChanged } from '../firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';

const CONDICIONES = [
  { value: 'ninguna',    emoji: '😊', label: 'Sin condición' },
  { value: 'asma',       emoji: '🫁', label: 'Asma' },
  { value: 'epoc',       emoji: '🩺', label: 'EPOC' },
  { value: 'rinitis',    emoji: '🤧', label: 'Rinitis alérgica' },
  { value: 'mayor',      emoji: '👴', label: 'Adulto mayor' },
  { value: 'nino',       emoji: '👶', label: 'Niño' },
  { value: 'embarazada', emoji: '🤰', label: 'Embarazada' },
];

export default function AjustesScreen() {
  const navigation  = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [email,      setEmail]      = useState('');
  const [uid,        setUid]        = useState('');
  const [condicion,  setCondicion]  = useState('ninguna');
  const [alertas,    setAlertas]    = useState(true);
  const [editSalud,  setEditSalud]  = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setEmail(user.email ?? '');
        setUid(user.uid);
        // Cargar perfil si existe
        onValue(ref(database, `usuarios/${user.uid}`), (snap) => {
          if (snap.exists()) {
            const d = snap.val();
            if (d.condicion_salud) setCondicion(d.condicion_salud);
            if (d.alertas_personalizadas !== undefined) setAlertas(d.alertas_personalizadas);
          }
        }, { onlyOnce: true });
      }
    });
    return () => unsubAuth();
  }, []);

  const guardarCondicion = async (val: string) => {
    setCondicion(val);
    setEditSalud(false);
    if (!uid) return;
    try {
      await set(ref(database, `usuarios/${uid}/condicion_salud`), val);
    } catch (e) {}
  };

  const toggleAlertas = async (val: boolean) => {
    setAlertas(val);
    if (!uid) return;
    try {
      await set(ref(database, `usuarios/${uid}/alertas_personalizadas`), val);
    } catch (e) {}
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await signOut(auth);
        navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
      }},
    ]);
  };

  const condActual = CONDICIONES.find(c => c.value === condicion);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Ajustes" />
      <ScrollView contentContainerStyle={styles.container}>

        {/* Perfil */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileEmail}>{email || 'Sin sesión'}</Text>
            <Text style={styles.profileUid}>UID: {uid.slice(0, 14)}...</Text>
          </View>
        </View>

        {/* Condición de salud */}
        <Text style={styles.sectionTitle}>Condición de salud</Text>
        <TouchableOpacity style={styles.condCard} onPress={() => setEditSalud(!editSalud)}>
          <Text style={{ fontSize: 24 }}>{condActual?.emoji}</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.condLabel}>{condActual?.label}</Text>
            <Text style={styles.condSub}>Toca para cambiar</Text>
          </View>
          <Text style={styles.condArrow}>{editSalud ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {editSalud && (
          <View style={styles.condList}>
            {CONDICIONES.map((c) => (
              <TouchableOpacity key={c.value} onPress={() => guardarCondicion(c.value)}
                style={[styles.condOption, condicion === c.value && styles.condOptionActive]}>
                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                <Text style={[styles.condOptionText, condicion === c.value && { color: '#007F7A', fontWeight: '800' }]}>
                  {c.label}
                </Text>
                {condicion === c.value && <Text style={{ color: '#007F7A', fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Preferencias */}
        <Text style={styles.sectionTitle}>Preferencias</Text>
        <View style={styles.prefCard}>
          <View>
            <Text style={styles.prefTitle}>Alertas push</Text>
            <Text style={styles.prefSub}>{alertas ? 'Activadas' : 'Desactivadas'}</Text>
          </View>
          <Switch value={alertas} onValueChange={toggleAlertas}
            trackColor={{ false: '#ccc', true: '#00AFAA80' }}
            thumbColor={alertas ? '#007F7A' : '#aaa'}
            ios_backgroundColor="#ccc" />
        </View>

        {/* Info sistema */}
        <Text style={styles.sectionTitle}>Sistema</Text>
        <View style={styles.infoCard}>
          {[
            { label: 'App', value: 'AirMonitoring v4.0' },
            { label: 'Modelo IA', value: 'Edge Impulse v4' },
            { label: 'Firebase', value: 'purificador-53617' },
            { label: 'Sensores', value: 'MQ-7 · MQ-135' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>© 2025 AirMonitoring — Franz Tamayo University</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: '#f5f5f5' },
  container:        { padding: 16, paddingBottom: 40 },
  profileCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, elevation: 2 },
  avatar:           { width: 64, height: 64, borderRadius: 20, backgroundColor: '#00AFAA15', borderWidth: 1.5, borderColor: '#00AFAA40', alignItems: 'center', justifyContent: 'center' },
  profileEmail:     { fontSize: 14, fontWeight: '700', color: '#333' },
  profileUid:       { fontSize: 11, color: '#aaa', marginTop: 3 },
  sectionTitle:     { fontSize: 14, fontWeight: '800', color: '#555', letterSpacing: 0.5, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  condCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 2, marginBottom: 6 },
  condLabel:        { fontSize: 15, fontWeight: '700', color: '#333' },
  condSub:          { fontSize: 11, color: '#aaa', marginTop: 2 },
  condArrow:        { fontSize: 12, color: '#aaa' },
  condList:         { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 16, elevation: 1 },
  condOption:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  condOptionActive: { backgroundColor: '#00AFAA08' },
  condOptionText:   { flex: 1, fontSize: 14, color: '#444' },
  prefCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, marginBottom: 16 },
  prefTitle:        { fontSize: 14, fontWeight: '700', color: '#333' },
  prefSub:          { fontSize: 11, color: '#aaa', marginTop: 2 },
  infoCard:         { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 1, marginBottom: 20 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel:        { fontSize: 13, color: '#888' },
  infoValue:        { fontSize: 13, fontWeight: '600', color: '#333' },
  logoutBtn:        { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 2, borderWidth: 1.5, borderColor: '#F4433640', marginBottom: 16 },
  logoutText:       { fontSize: 15, fontWeight: '800', color: '#F44336' },
  footer:           { textAlign: 'center', fontSize: 11, color: '#bbb' },
});
