import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import Header from '../components/Header';
import { database, ref, query, orderByKey, limitToLast, onValue, auth } from '../firebaseConfig';

const { width } = Dimensions.get('window');

type Filtro  = '24h' | '7d' | '30d';
type GasKey  = 'co2_ppm' | 'co_ppm' | 'nh3_ppm' | 'pm25_ugm3' | 'cov_ppm';
type Seccion = 'mis_purificadores' | 'general';

const CIUDADES_GENERAL = [
  { id: 'cochabamba', label: 'Cbba.',     color: '#00AFAA' },
  { id: 'la_paz',     label: 'La Paz',    color: '#818cf8' },
  { id: 'santa_cruz', label: 'Sta. Cruz', color: '#f97316' },
];
const FILTROS: Filtro[] = ['24h', '7d', '30d'];
const GASES: { key: GasKey; label: string; color: string; unit: string }[] = [
  { key: 'co2_ppm',   label: 'CO₂',   color: '#818cf8', unit: 'ppm'   },
  { key: 'co_ppm',    label: 'CO',    color: '#f97316', unit: 'ppm'   },
  { key: 'nh3_ppm',   label: 'NH₃',   color: '#a78bfa', unit: 'ppm'   },
  { key: 'pm25_ugm3', label: 'PM2.5', color: '#F43F5E', unit: 'μg/m³' },
  { key: 'cov_ppm',   label: 'COV',   color: '#06B6D4', unit: 'ppm'   },
];
const LIMITES: Record<Filtro, number> = { '24h': 48, '7d': 200, '30d': 500 };
const SECS:    Record<Filtro, number> = { '24h': 86400, '7d': 604800, '30d': 2592000 };

function colorCalidad(c: string) {
  const v = (c ?? '').toLowerCase();
  if (v === 'bueno')     return '#4CAF50';
  if (v === 'moderado')  return '#FF9800';
  if (v === 'peligroso') return '#F44336';
  return '#999';
}

function StatCard({ label, value, color, unit }: { label: string; value: string; color: string; unit: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

// ── Sección de historial (reutilizable para ambas vistas) ──
function SeccionHistorial({
  ciudad, filtro, gasKey, loading, history,
}: {
  ciudad: string; filtro: Filtro; gasKey: GasKey;
  loading: boolean; history: any[];
}) {
  const puntos  = history.slice(-20);
  const labels  = puntos.map((_, i) => (i % 5 === 0 ? `${i}` : ''));
  const datos   = puntos.map((r) => Math.max(Number(r[gasKey]) || 0, 0));
  const gasInfo = GASES.find(g => g.key === gasKey)!;
  const decPlaces = (gasKey === 'co_ppm' || gasKey === 'cov_ppm') ? 2 : gasKey === 'pm25_ugm3' ? 1 : 0;

  const valoresGas = history.map((r) => Number(r[gasKey]) || 0).filter((v) => v > 0);
  const stats = valoresGas.length > 0 ? {
    max:  Math.max(...valoresGas),
    min:  Math.min(...valoresGas),
    prom: valoresGas.reduce((a, b) => a + b, 0) / valoresGas.length,
  } : null;

  return (
    <>
      {/* Estadísticas max/min/promedio */}
      {stats && !loading && (
        <View style={styles.statsRow}>
          <StatCard label="Máximo"   value={stats.max.toFixed(decPlaces)}  color="#F44336"     unit={gasInfo.unit} />
          <StatCard label="Promedio" value={stats.prom.toFixed(decPlaces)} color={gasInfo.color} unit={gasInfo.unit} />
          <StatCard label="Mínimo"   value={stats.min.toFixed(decPlaces)}  color="#4CAF50"     unit={gasInfo.unit} />
        </View>
      )}

      {/* Gráfica */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{gasInfo.label} — {ciudad}</Text>
        <Text style={styles.chartSub}>{history.length} registros · {filtro}</Text>
        {loading ? (
          <ActivityIndicator color="#007F7A" style={{ margin: 40 }} />
        ) : puntos.length > 1 ? (
          <LineChart
            data={{ labels, datasets: [{ data: datos.length > 0 ? datos : [0], color: () => gasInfo.color }] }}
            width={width - 40}
            height={180}
            chartConfig={{
              backgroundColor: '#fff', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff',
              decimalPlaces: decPlaces,
              color: () => gasInfo.color, labelColor: () => '#999',
              propsForDots: { r: '3', stroke: gasInfo.color },
              propsForBackgroundLines: { stroke: '#eee' },
            }}
            bezier withInnerLines={false}
            style={{ marginLeft: -10, marginTop: 8 }}
          />
        ) : (
          <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#aaa' }}>{loading ? 'Cargando...' : 'Sin datos en este período'}</Text>
          </View>
        )}
      </View>

      {/* Tabla */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>Hora</Text>
          <Text style={styles.tableHeaderText}>CO₂</Text>
          <Text style={styles.tableHeaderText}>CO</Text>
          <Text style={styles.tableHeaderText}>IA %</Text>
          <Text style={styles.tableHeaderText}>Estado</Text>
        </View>
        {history.length === 0 && !loading && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#aaa' }}>Sin registros en este período</Text>
          </View>
        )}
        {history.slice(-30).reverse().map((r, i) => (
          <View key={r._key ?? i}
            style={[styles.tableRow, i % 2 === 1 && { backgroundColor: '#f9f9f9' }]}>
            <Text style={styles.tableCell} numberOfLines={1}>
              {(r.timestamp ?? '—').split(' ')[1] ?? r.timestamp ?? '—'}
            </Text>
            <Text style={styles.tableCell}>{(r.co2_ppm ?? 0).toFixed(0)}</Text>
            <Text style={styles.tableCell}>{(r.co_ppm  ?? 0).toFixed(1)}</Text>
            <Text style={[styles.tableCell, { color: '#818cf8', fontWeight: '700' }]}>
              {(r.confianza_ia ?? 0) > 0 ? `${(r.confianza_ia as number).toFixed(0)}%` : '—'}
            </Text>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ backgroundColor: colorCalidad(r.calidad_aire) + '20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: colorCalidad(r.calidad_aire), fontSize: 9, fontWeight: '800' }}>
                  {(r.calidad_aire ?? '—').slice(0, 3).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function HistorialScreen() {
  const [seccion, setSeccion] = useState<Seccion>('general');
  const [filtro,  setFiltro]  = useState<Filtro>('24h');
  const [gasKey,  setGasKey]  = useState<GasKey>('co2_ppm');

  // ── Sección General ───────────────────────────────────────
  const [ciudadGeneral, setCiudadGeneral] = useState('cochabamba');
  const [histGeneral,   setHistGeneral]   = useState<any[]>([]);
  const [loadingGen,    setLoadingGen]    = useState(true);

  // ── Sección Mis Purificadores ─────────────────────────────
  const [misPurificadores, setMisPurificadores] = useState<{ id: string; nombre: string; ciudad: string }[]>([]);
  const [purificadorSel,   setPurificadorSel]   = useState<string>('');
  const [histMio,          setHistMio]          = useState<any[]>([]);
  const [loadingMio,       setLoadingMio]       = useState(false);

  // Cargar historial general
  useEffect(() => {
    if (seccion !== 'general') return;
    setLoadingGen(true);
    const q = query(ref(database, `data/${ciudadGeneral}`), orderByKey(), limitToLast(LIMITES[filtro]));
    const unsub = onValue(q, (snap) => {
      if (snap.exists()) {
        const now = Date.now() / 1000;
        const arr = Object.entries(snap.val())
          .map(([k, v]: any) => ({ _key: k, ...v }))
          .filter((r) => !r.epoch || (now - r.epoch) <= SECS[filtro]);
        setHistGeneral(arr);
      } else {
        setHistGeneral([]);
      }
      setLoadingGen(false);
    });
    return () => unsub();
  }, [ciudadGeneral, filtro, seccion]);

  // Cargar mis purificadores registrados
  useEffect(() => {
    if (seccion !== 'mis_purificadores') return;
    const uid = auth.currentUser?.uid;
    const unsub = onValue(ref(database, 'dispositivos_registrados'), (snap) => {
      if (!snap.exists()) { setMisPurificadores([]); return; }
      const todos = Object.entries(snap.val() as Record<string, any>)
        .filter(([id, d]) => {
          // Excluir entradas generales (no son purificadores del usuario)
          const esGeneral = ['cochabamba', 'la_paz', 'santa_cruz', 'oruro', 'potosi', 'sucre'].includes(id);
          // Solo mostrar dispositivos activos con nombre personalizado
          const tieneNombre = d.nombre && d.nombre.length > 0;
          return !esGeneral && d.activo !== false && tieneNombre;
        })
        .map(([id, d]) => ({ id, nombre: d.nombre || id, ciudad: d.firebase_path || d.ciudad || '' }));
      setMisPurificadores(todos);
      if (todos.length > 0 && !purificadorSel) {
        setPurificadorSel(todos[0].ciudad);
      }
    });
    return () => unsub();
  }, [seccion]);

  // Cargar historial del purificador seleccionado
  useEffect(() => {
    if (seccion !== 'mis_purificadores' || !purificadorSel) return;
    setLoadingMio(true);
    const q = query(ref(database, `data/${purificadorSel}`), orderByKey(), limitToLast(LIMITES[filtro]));
    const unsub = onValue(q, (snap) => {
      if (snap.exists()) {
        const now = Date.now() / 1000;
        const arr = Object.entries(snap.val())
          .map(([k, v]: any) => ({ _key: k, ...v }))
          .filter((r) => !r.epoch || (now - r.epoch) <= SECS[filtro]);
        setHistMio(arr);
      } else {
        setHistMio([]);
      }
      setLoadingMio(false);
    });
    return () => unsub();
  }, [purificadorSel, filtro, seccion]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Datos" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Selector de sección ── */}
        <View style={styles.seccionRow}>
          <TouchableOpacity
            style={[styles.seccionBtn, seccion === 'mis_purificadores' && styles.seccionBtnActive]}
            onPress={() => setSeccion('mis_purificadores')}
          >
            <Text style={styles.seccionIcon}>💨</Text>
            <Text style={[styles.seccionLabel, seccion === 'mis_purificadores' && styles.seccionLabelActive]}>
              Mis purificadores
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.seccionBtn, seccion === 'general' && styles.seccionBtnActive]}
            onPress={() => setSeccion('general')}
          >
            <Text style={styles.seccionIcon}>🌍</Text>
            <Text style={[styles.seccionLabel, seccion === 'general' && styles.seccionLabelActive]}>
              General
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Controles comunes (filtro tiempo + gas) ── */}
        <View style={styles.filtroRow}>
          {FILTROS.map((f) => (
            <TouchableOpacity key={f} onPress={() => setFiltro(f)}
              style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}>
              <Text style={[styles.filtroLabel, filtro === f && styles.filtroLabelActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.selectorRow}>
          {GASES.map((g) => (
            <TouchableOpacity key={g.key} onPress={() => setGasKey(g.key)}
              style={[styles.selectorBtn, gasKey === g.key && { backgroundColor: g.color + '20', borderColor: g.color }]}>
              <Text style={[styles.selectorLabel, gasKey === g.key && { color: g.color, fontWeight: '800' }]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════
            SECCIÓN: MIS PURIFICADORES
        ══════════════════════════════════════════════════ */}
        {seccion === 'mis_purificadores' && (
          <>
            {misPurificadores.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>💨</Text>
                <Text style={styles.emptyTitle}>Sin purificadores registrados</Text>
                <Text style={styles.emptyDesc}>
                  Configura tu primer purificador desde la pantalla Dispositivos → Agregar purificador
                </Text>
              </View>
            ) : (
              <>
                {/* Selector de purificador */}
                <Text style={styles.subSectionTitle}>Selecciona un purificador</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {misPurificadores.map((p) => (
                    <TouchableOpacity key={p.id}
                      style={[styles.purChip, purificadorSel === p.ciudad && styles.purChipActive]}
                      onPress={() => setPurificadorSel(p.ciudad)}>
                      <Text style={styles.purChipIcon}>💨</Text>
                      <View>
                        <Text style={[styles.purChipName, purificadorSel === p.ciudad && { color: '#007F7A' }]}>
                          {p.nombre}
                        </Text>
                        <Text style={styles.purChipCiudad}>{p.ciudad}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {purificadorSel && (
                  <SeccionHistorial
                    ciudad={misPurificadores.find(p => p.ciudad === purificadorSel)?.nombre ?? purificadorSel}
                    filtro={filtro} gasKey={gasKey}
                    loading={loadingMio} history={histMio}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            SECCIÓN: GENERAL (3 ciudades predefinidas)
        ══════════════════════════════════════════════════ */}
        {seccion === 'general' && (
          <>
            {/* Selector ciudad */}
            <Text style={styles.subSectionTitle}>Ciudad</Text>
            <View style={styles.selectorRow}>
              {CIUDADES_GENERAL.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => setCiudadGeneral(c.id)}
                  style={[styles.selectorBtn, ciudadGeneral === c.id && { backgroundColor: c.color + '20', borderColor: c.color }]}>
                  <Text style={[styles.selectorLabel, ciudadGeneral === c.id && { color: c.color, fontWeight: '800' }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <SeccionHistorial
              ciudad={CIUDADES_GENERAL.find(c => c.id === ciudadGeneral)?.label ?? ciudadGeneral}
              filtro={filtro} gasKey={gasKey}
              loading={loadingGen} history={histGeneral}
            />
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:          { flex: 1, backgroundColor: '#f5f5f5' },
  container:         { padding: 16, paddingBottom: 40 },

  // Sección tabs
  seccionRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  seccionBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#eee', elevation: 1 },
  seccionBtnActive:  { backgroundColor: '#00AFAA15', borderColor: '#007F7A' },
  seccionIcon:       { fontSize: 18 },
  seccionLabel:      { fontSize: 13, fontWeight: '700', color: '#888' },
  seccionLabelActive:{ color: '#007F7A' },

  // Sub sección título
  subSectionTitle:   { fontSize: 12, fontWeight: '800', color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },

  // Filtros
  filtroRow:         { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  filtroBtn:         { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  filtroBtnActive:   { backgroundColor: '#f0f0f0' },
  filtroLabel:       { fontSize: 12, color: '#aaa', fontWeight: '600' },
  filtroLabelActive: { color: '#00AFAA', fontWeight: '800' },

  // Selectores
  selectorRow:       { flexDirection: 'row', gap: 8, marginBottom: 10 },
  selectorBtn:       { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd' },
  selectorLabel:     { fontSize: 11, color: '#666' },

  // Estadísticas
  statsRow:          { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:          { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 2 },
  statLabel:         { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  statValue:         { fontSize: 20, fontWeight: '900', color: '#333' },
  statUnit:          { fontSize: 10, color: '#aaa', marginTop: 2 },

  // Gráfica
  chartCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2 },
  chartTitle:        { fontSize: 14, fontWeight: '700', color: '#333' },
  chartSub:          { fontSize: 11, color: '#aaa', marginBottom: 4 },

  // Tabla
  tableCard:         { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, marginBottom: 14 },
  tableHeader:       { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 10 },
  tableHeaderText:   { flex: 1, fontSize: 10, fontWeight: '800', color: '#555', textAlign: 'center' },
  tableRow:          { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  tableCell:         { flex: 1, fontSize: 10, color: '#444', textAlign: 'center' },

  // Mis purificadores
  purChip:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, borderWidth: 1.5, borderColor: '#eee', elevation: 1 },
  purChipActive:     { backgroundColor: '#00AFAA15', borderColor: '#007F7A' },
  purChipIcon:       { fontSize: 22 },
  purChipName:       { fontSize: 13, fontWeight: '800', color: '#333' },
  purChipCiudad:     { fontSize: 10, color: '#aaa', marginTop: 1 },

  // Empty state
  emptyCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', elevation: 1, marginTop: 8 },
  emptyIcon:         { fontSize: 44, marginBottom: 12 },
  emptyTitle:        { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 8 },
  emptyDesc:         { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20 },
});
