import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Switch, Alert, StatusBar,
} from 'react-native';
import Header from '../components/Header';
import { auth, database, ref, onValue, set } from '../firebaseConfig';
import { signOut, onAuthStateChanged } from '../firebaseConfig';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { C, R } from '../theme';

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [email,           setEmail]           = useState('');
  const [uid,             setUid]             = useState('');
  const [condicion,       setCondicion]       = useState('ninguna');
  const [alertas,         setAlertas]         = useState(true);
  const [editSalud,       setEditSalud]       = useState(false);
  const [misDispositivos, setMisDispositivos] = useState<
    { id: string; nombre: string; ciudad: string; calidad: string }[]
  >([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setEmail(user.email ?? '');
        setUid(user.uid);
        onValue(ref(database, `usuarios/${user.uid}`), (snap) => {
          if (snap.exists()) {
            const d = snap.val();
            if (d.condicion_salud)                   setCondicion(d.condicion_salud);
            if (d.alertas_personalizadas !== undefined) setAlertas(d.alertas_personalizadas);
          }
        }, { onlyOnce: true });
        const unsubDevs = onValue(ref(database, `dispositivos/${user.uid}`), (snap) => {
          if (snap.exists()) {
            setMisDispositivos(
              Object.entries(snap.val() as Record<string, any>).map(([id, d]) => ({
                id,
                nombre:  d.nombre       || id,
                ciudad:  d.ciudad       || '—',
                calidad: d.calidad_aire || '—',
              }))
            );
          } else {
            setMisDispositivos([]);
          }
        });
        return () => unsubDevs();
      }
    });
    return () => unsubAuth();
  }, []);

  const guardarCondicion = async (val: string) => {
    setCondicion(val);
    setEditSalud(false);
    if (!uid) return;
    try { await set(ref(database, `usuarios/${uid}/condicion_salud`), val); } catch {}
  };

  const toggleAlertas = async (val: boolean) => {
    setAlertas(val);
    if (!uid) return;
    try { await set(ref(database, `usuarios/${uid}/alertas_personalizadas`), val); } catch {}
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
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Header title="Ajustes" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Perfil ── */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarEmoji}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileEmail}>{email || 'Sin sesión'}</Text>
            {uid ? <Text style={s.profileUid}>UID: {uid.slice(0, 16)}…</Text> : null}
          </View>
        </View>

        {/* ── Condición de salud ── */}
        <Text style={s.sectionTitle}>Condición de salud</Text>
        <TouchableOpacity style={s.card} onPress={() => setEditSalud(!editSalud)}>
          <Text style={{ fontSize: 26 }}>{condActual?.emoji}</Text>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.cardTitle}>{condActual?.label}</Text>
            <Text style={s.cardSub}>Toca para cambiar</Text>
          </View>
          <Text style={s.arrow}>{editSalud ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {editSalud && (
          <View style={s.condList}>
            {CONDICIONES.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => guardarCondicion(c.value)}
                style={[s.condOption, condicion === c.value && s.condOptionActive]}
              >
                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                <Text style={[s.condOptionText, condicion === c.value && { color: C.teal, fontWeight: '800' }]}>
                  {c.label}
                </Text>
                {condicion === c.value && <Text style={{ color: C.teal, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Preferencias ── */}
        <Text style={s.sectionTitle}>Preferencias</Text>
        <View style={[s.card, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={s.cardTitle}>Alertas push</Text>
            <Text style={s.cardSub}>{alertas ? 'Activadas' : 'Desactivadas'}</Text>
          </View>
          <Switch
            value={alertas}
            onValueChange={toggleAlertas}
            trackColor={{ false: C.border, true: C.teal + '80' }}
            thumbColor={alertas ? C.teal : C.textMuted}
            ios_backgroundColor={C.border}
          />
        </View>

        {/* ── Sistema ── */}
        <Text style={s.sectionTitle}>Sistema</Text>
        <View style={s.infoCard}>
          {[
            { label: 'App',        value: 'AirMonitoring v4.0' },
            { label: 'Modelo IA',  value: 'Edge Impulse v4'    },
            { label: 'Firebase',   value: 'purificador-53617'  },
            { label: 'Sensores',   value: 'MQ-7 · MQ-135'      },
          ].map(({ label, value }) => (
            <View key={label} style={s.infoRow}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Mis purificadores ── */}
        <Text style={s.sectionTitle}>Mis purificadores</Text>
        <View style={s.infoCard}>
          {misDispositivos.length === 0 ? (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Sin dispositivos</Text>
              <Text style={s.infoValue}>—</Text>
            </View>
          ) : (
            misDispositivos.map((d) => {
              const col =
                d.calidad.toLowerCase() === 'bueno'     ? C.green  :
                d.calidad.toLowerCase() === 'moderado'  ? C.amber  :
                d.calidad.toLowerCase() === 'peligroso' ? C.red    : C.textMuted;
              return (
                <View key={d.id} style={[s.infoRow, { alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoLabel}>{d.nombre}</Text>
                    <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{d.ciudad}</Text>
                  </View>
                  <View style={[s.calBadge, { backgroundColor: col + '25' }]}>
                    <Text style={[s.calBadgeText, { color: col }]}>
                      {d.calidad === '—' || d.calidad === 'Inicializando' ? '—' : d.calidad}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Cerrar sesión ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={s.footer}>© 2025 AirMonitoring — Franz Tamayo University</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: C.bg },
  scroll:          { padding: 16, paddingBottom: 48 },

  profileCard:     { backgroundColor: C.bgCard, borderRadius: R.xl, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  avatar:          { width: 60, height: 60, borderRadius: 18, backgroundColor: C.tealDim, borderWidth: 1.5, borderColor: C.tealBorder, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji:     { fontSize: 28 },
  profileEmail:    { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  profileUid:      { fontSize: 11, color: C.textMuted, marginTop: 4 },

  sectionTitle:    { fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 1.5, marginBottom: 10, marginTop: 6, textTransform: 'uppercase' },

  card:            { backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  cardTitle:       { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  cardSub:         { fontSize: 11, color: C.textMuted, marginTop: 3 },
  arrow:           { fontSize: 11, color: C.textMuted },

  condList:        { backgroundColor: C.bgCard, borderRadius: R.lg, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  condOption:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  condOptionActive:{ backgroundColor: C.tealDim },
  condOptionText:  { flex: 1, fontSize: 14, color: C.textSecondary },

  infoCard:        { backgroundColor: C.bgCard, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel:       { fontSize: 13, color: C.textMuted },
  infoValue:       { fontSize: 13, fontWeight: '600', color: C.textSecondary },

  logoutBtn:       { backgroundColor: C.bgCard, borderRadius: R.lg, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.red + '50', marginBottom: 20 },
  logoutText:      { fontSize: 15, fontWeight: '800', color: C.red },

  calBadge:        { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  calBadgeText:    { fontSize: 10, fontWeight: '800' },

  footer:          { textAlign: 'center', fontSize: 11, color: C.textMuted },
});
