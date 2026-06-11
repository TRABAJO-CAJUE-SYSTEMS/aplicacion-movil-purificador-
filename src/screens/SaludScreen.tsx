import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, StatusBar,
} from 'react-native';
import Header from '../components/Header';
import { database, ref, onValue, auth } from '../firebaseConfig';
import { C, R } from '../theme';

// ═══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN POR CONDICIÓN DE SALUD
// ═══════════════════════════════════════════════════════════════
const CONDICION_CONFIG = {
  ninguna: {
    emoji: '😊', label: 'Sin condición especial', color: '#00C9BE',
    thresholds: {
      co2: { warn: 1500, danger: 2500 },
      co:  { warn: 30,   danger: 87   },
      nh3: { warn: 25,   danger: 50   },
    },
    gasesRiesgo: ['CO₂', 'CO', 'NH₃'] as string[],
    acciones: {
      bueno:     ['El aire está en condiciones óptimas.', 'Puedes realizar cualquier actividad sin restricciones.', 'Buen momento para ventilar espacios cerrados.'],
      moderado:  ['Reduce actividades físicas intensas en exteriores.', 'Ventila si hay concentración de personas.', 'Mantén el purificador encendido.'],
      peligroso: ['Evita salir al exterior.', 'Enciende el purificador al máximo.', 'Cierra ventanas si el exterior está contaminado.'],
    },
  },
  asma: {
    emoji: '🫁', label: 'Asma', color: '#818CF8',
    thresholds: {
      co2: { warn: 800,  danger: 1500 },
      co:  { warn: 10,   danger: 30   },
      nh3: { warn: 10,   danger: 25   },
    },
    gasesRiesgo: ['CO₂', 'NH₃'] as string[],
    acciones: {
      bueno:     ['Condiciones favorables para tu asma.', 'Mantén tu medicación preventiva al día.', 'Puedes hacer ejercicio moderado sin riesgo.'],
      moderado:  ['Ten el broncodilatador de rescate a mano.', 'Evita ejercicio intenso o correr.', 'Enciende el purificador.', 'Monitorea síntomas: silbido al respirar, opresión en el pecho.'],
      peligroso: ['Usa el broncodilatador de rescate ahora si hay síntomas.', 'Sal del ambiente contaminado de inmediato.', 'Si no mejoras en 20 minutos, llama a tu médico.', 'Enciende el purificador al máximo.'],
    },
  },
  epoc: {
    emoji: '🩺', label: 'EPOC', color: '#EF4444',
    thresholds: {
      co2: { warn: 700,  danger: 1200 },
      co:  { warn: 8,    danger: 20   },
      nh3: { warn: 8,    danger: 20   },
    },
    gasesRiesgo: ['CO₂', 'CO', 'NH₃'] as string[],
    acciones: {
      bueno:     ['Condiciones favorables para ti.', 'Actividad física ligera permitida.', 'Mantén tu terapia de oxígeno si la usas.'],
      moderado:  ['Limita actividades que aumenten tu respiración.', 'Usa mascarilla si necesitas salir.', 'Ten tu inhalador cerca.', 'Evita cocinar sin ventilación.'],
      peligroso: ['Quédate en interior con purificador encendido.', 'Usa oxígeno suplementario si lo tienes.', 'Llama a tu médico si hay disnea severa.', '¡No hagas ningún esfuerzo físico!'],
    },
  },
  rinitis: {
    emoji: '🤧', label: 'Rinitis alérgica', color: '#F97316',
    thresholds: {
      co2: { warn: 1200, danger: 2000 },
      co:  { warn: 20,   danger: 60   },
      nh3: { warn: 5,    danger: 15   },
    },
    gasesRiesgo: ['NH₃', 'CO₂'] as string[],
    acciones: {
      bueno:     ['Condiciones favorables para tu rinitis.', 'Puedes estar en exteriores con normalidad.', 'Buena ventilación natural hoy.'],
      moderado:  ['El NH₃ puede irritar tus vías nasales.', 'Evita ambientes con humo o polvo.', 'Mantén antihistamínico disponible.'],
      peligroso: ['Alto riesgo de crisis alérgica.', 'Usa mascarilla en lo posible.', 'Toma tu antihistamínico preventivo.', 'Enciende el purificador.'],
    },
  },
  mayor: {
    emoji: '👴', label: 'Adulto mayor', color: '#0EA5E9',
    thresholds: {
      co2: { warn: 1000, danger: 1800 },
      co:  { warn: 15,   danger: 40   },
      nh3: { warn: 15,   danger: 35   },
    },
    gasesRiesgo: ['CO₂', 'CO'] as string[],
    acciones: {
      bueno:     ['Condiciones seguras para actividades normales.', 'Puedes salir a caminar tranquilamente.'],
      moderado:  ['Reduce actividades al aire libre.', 'Mantente bien hidratado.', 'Descansa si sientes cansancio inusual.'],
      peligroso: ['Quédate en interior.', 'Enciende el purificador.', 'Avisa a un familiar o cuidador.', 'Llama al médico si sientes mareo o falta de aire.'],
    },
  },
  nino: {
    emoji: '👶', label: 'Niño', color: '#22D3A0',
    thresholds: {
      co2: { warn: 900,  danger: 1500 },
      co:  { warn: 10,   danger: 25   },
      nh3: { warn: 10,   danger: 20   },
    },
    gasesRiesgo: ['CO₂', 'NH₃'] as string[],
    acciones: {
      bueno:     ['Ambiente seguro para el niño.', 'Puede jugar y hacer todas sus actividades normalmente.'],
      moderado:  ['Limita el tiempo de juego en exterior.', 'Prioriza actividades en interior con purificador encendido.'],
      peligroso: ['Lleva al niño a otra habitación o zona limpia.', 'Enciende el purificador al máximo.', 'Si hay tos persistente, consulta al pediatra.'],
    },
  },
  embarazada: {
    emoji: '🤰', label: 'Embarazada', color: '#EC4899',
    thresholds: {
      co2: { warn: 1000, danger: 1800 },
      co:  { warn: 10,   danger: 25   },
      nh3: { warn: 10,   danger: 25   },
    },
    gasesRiesgo: ['CO', 'CO₂'] as string[],
    acciones: {
      bueno:     ['Ambiente seguro para ti y tu bebé.', 'Actividad física moderada permitida.'],
      moderado:  ['Evita exposición prolongada.', 'Enciende el purificador.', 'Descansa y mantente hidratada.'],
      peligroso: ['El CO es especialmente peligroso en el embarazo.', 'Sal del ambiente de inmediato.', 'Consulta a tu obstetra si hubo exposición prolongada.', 'Ve a urgencias si sientes mareo o dolor de cabeza intenso.'],
    },
  },
} as const;

type CondicionKey = keyof typeof CONDICION_CONFIG;
type NivelRiesgo  = 'bueno' | 'moderado' | 'peligroso';

interface DispositivoState {
  nombre?:              string;
  ciudad?:              string;
  calidad_aire:         string;
  co2_ppm:              number;
  co_ppm:               number;
  nh3_ppm:              number;
  gas_critico?:         string;
  ultima_actualizacion?: string;
}

// ── Colores de nivel ──────────────────────────────────────────
const nivelColor: Record<NivelRiesgo, string> = {
  bueno:     '#22D3A0',
  moderado:  '#F59E0B',
  peligroso: '#EF4444',
};
const nivelLabel: Record<NivelRiesgo, string> = {
  bueno:     'SEGURO PARA TI',
  moderado:  'PRECAUCIÓN',
  peligroso: 'RIESGO ALTO',
};
const nivelEmoji: Record<NivelRiesgo, string> = {
  bueno:     '✓',
  moderado:  '⚠',
  peligroso: '🚨',
};

// ═══════════════════════════════════════════════════════════════
//  LÓGICA DE CÁLCULO
// ═══════════════════════════════════════════════════════════════
function calcularRiesgoPersonal(
  gases: { co2: number; co: number; nh3: number },
  config: typeof CONDICION_CONFIG[CondicionKey]
): { nivel: NivelRiesgo; gasProblema: string | null; score: number } {
  const t = config.thresholds;

  const nivelGas = (val: number, warn: number, danger: number): NivelRiesgo =>
    val >= danger ? 'peligroso' : val >= warn ? 'moderado' : 'bueno';

  const niveles = [
    { gas: 'CO₂', nivel: nivelGas(gases.co2, t.co2.warn, t.co2.danger), ratio: gases.co2 / t.co2.danger },
    { gas: 'CO',  nivel: nivelGas(gases.co,  t.co.warn,  t.co.danger),  ratio: gases.co  / t.co.danger  },
    { gas: 'NH₃', nivel: nivelGas(gases.nh3, t.nh3.warn, t.nh3.danger), ratio: gases.nh3 / t.nh3.danger },
  ];

  const nivel: NivelRiesgo =
    niveles.some(n => n.nivel === 'peligroso') ? 'peligroso' :
    niveles.some(n => n.nivel === 'moderado')  ? 'moderado'  : 'bueno';

  const maxRatio    = Math.max(...niveles.map(n => n.ratio));
  const score       = Math.max(0, Math.min(100, Math.round(100 - maxRatio * 80)));
  const gasProblema = niveles.find(n => n.nivel !== 'bueno')?.gas ?? null;

  return { nivel, gasProblema, score };
}

function calcularTiempoSeguro(
  gases: { co2: number; co: number; nh3: number },
  config: typeof CONDICION_CONFIG[CondicionKey]
): string {
  const t = config.thresholds;
  const ratios = [
    gases.co2 / t.co2.warn,
    gases.co  / t.co.warn,
    gases.nh3 / t.nh3.warn,
  ].filter(r => isFinite(r) && r > 0);
  const max = Math.max(...ratios);
  if (max < 0.5)  return 'Sin límite';
  if (max < 0.75) return '> 4 horas';
  if (max < 1.0)  return '~2 horas';
  if (max < 1.4)  return '~45 min';
  if (max < 2.0)  return '~15 min';
  return 'Salir ya';
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENTES INTERNOS
// ═══════════════════════════════════════════════════════════════

// Barra de score animada
function ScoreBar({ score, color }: { score: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue:        score / 100,
      duration:       1200,
      useNativeDriver: false,
    }).start();
  }, [score]);
  const w = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View>
      <View style={s.scoreRow}>
        <Text style={s.scoreLabel}>Índice de salud ambiental</Text>
        <Text style={[s.scoreNum, { color }]}>{score}/100</Text>
      </View>
      <View style={s.scoreTrack}>
        <Animated.View style={[s.scoreFill, { width: w, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// Barra de gas con umbral personalizado
function GasBar({
  label, valor, warn, danger, unidad, colorGas,
}: {
  label: string; valor: number; warn: number; danger: number; unidad: string; colorGas: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct  = Math.min(valor / (danger * 1.2), 1);
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1000, useNativeDriver: false }).start();
  }, [valor]);
  const w     = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const color = valor >= danger ? '#EF4444' : valor >= warn ? '#F59E0B' : colorGas;
  const alerta= valor >= warn;
  const warnPct = Math.min((warn / (danger * 1.2)) * 100, 95);

  return (
    <View style={s.gasRow}>
      <View style={s.gasHeader}>
        <Text style={[s.gasLabel, alerta && { color }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {alerta && <Text style={{ color, fontSize: 11, fontWeight: '800' }}>⚠</Text>}
          <Text style={[s.gasVal, { color }]}>
            {valor < 10 ? valor.toFixed(2) : valor.toFixed(0)}
            <Text style={s.gasUnit}> {unidad}</Text>
          </Text>
        </View>
      </View>
      <View style={s.gasTrack}>
        <Animated.View style={[s.gasFill, { width: w, backgroundColor: color }]} />
        {/* Marcador del umbral personal */}
        <View style={[s.warnMarker, { left: `${warnPct}%` as any }]} />
      </View>
      <Text style={s.gasThreshold}>Tu límite: {warn} {unidad}</Text>
    </View>
  );
}

// Item de acción
function AccionItem({ texto, index }: { texto: string; index: number }) {
  return (
    <View style={s.accionRow}>
      <View style={s.accionNum}>
        <Text style={s.accionNumTxt}>{index + 1}</Text>
      </View>
      <Text style={s.accionTxt}>{texto}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function SaludScreen() {
  const uid = auth.currentUser?.uid ?? '';

  const [condicion,      setCondicion]      = useState<CondicionKey>('ninguna');
  const [dispositivos,   setDispositivos]   = useState<Record<string, DispositivoState>>({});
  const [dispositivoSel, setDispositivoSel] = useState<string>('');

  // Cargar condición de salud del usuario
  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(database, `usuarios/${uid}/condicion_salud`), (snap) => {
      if (snap.exists()) {
        const val = snap.val() as string;
        if (val in CONDICION_CONFIG) setCondicion(val as CondicionKey);
      }
    });
    return () => unsub();
  }, [uid]);

  // Cargar todos los dispositivos en tiempo real
  useEffect(() => {
    if (!uid) return;
    const unsub = onValue(ref(database, `dispositivos/${uid}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val() as Record<string, DispositivoState>;
        setDispositivos(data);
        if (!dispositivoSel || !(dispositivoSel in data)) {
          setDispositivoSel(Object.keys(data)[0] ?? '');
        }
      } else {
        setDispositivos({});
        setDispositivoSel('');
      }
    });
    return () => unsub();
  }, [uid]);

  // ── Cálculos ───────────────────────────────────────────────
  const config      = CONDICION_CONFIG[condicion];
  const datosSel    = dispositivoSel ? dispositivos[dispositivoSel] : null;
  const sinDatos    = !datosSel;

  const gases = {
    co2: datosSel?.co2_ppm ?? 0,
    co:  datosSel?.co_ppm  ?? 0,
    nh3: datosSel?.nh3_ppm ?? 0,
  };

  const { nivel, gasProblema, score } = calcularRiesgoPersonal(gases, config);
  const tiempoSeguro                   = calcularTiempoSeguro(gases, config);
  const acciones                       = config.acciones[nivel];
  const colorNivel                     = nivelColor[nivel];

  // Actividades según condición + nivel
  const actividades = [
    { emoji: '🚶', titulo: 'Paseo al aire libre',
      ok: nivel === 'bueno' || (nivel === 'moderado' && condicion === 'ninguna') },
    { emoji: '🚴', titulo: 'Ejercicio exterior',
      ok: nivel === 'bueno' && !(['asma', 'epoc'] as CondicionKey[]).includes(condicion) },
    { emoji: '🌬️', titulo: 'Ventilación natural',
      ok: nivel !== 'peligroso' },
    { emoji: '⚡', titulo: 'Actividad intensa',
      ok: nivel === 'bueno' && condicion === 'ninguna' },
  ];

  const haySinDatos = Object.keys(dispositivos).length === 0;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Header title="Salud" subtitle="Monitoreo personalizado" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Perfil de salud + selector de dispositivo ── */}
        <View style={[s.perfilCard, { borderColor: config.color + '50' }]}>
          <View style={s.perfilTop}>
            <View style={[s.perfilIconBox, { backgroundColor: config.color + '20' }]}>
              <Text style={s.perfilEmoji}>{config.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.perfilSub}>Tu perfil de salud</Text>
              <Text style={[s.perfilLabel, { color: config.color }]}>{config.label}</Text>
              <Text style={s.perfilHint}>Configura en Ajustes → Condición de salud</Text>
            </View>
          </View>
        </View>

        {/* ── Selector de dispositivo ── */}
        {Object.keys(dispositivos).length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {Object.entries(dispositivos).map(([id, d]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setDispositivoSel(id)}
                style={[s.devBtn, dispositivoSel === id && { borderColor: config.color, backgroundColor: config.color + '20' }]}
              >
                <Text style={[s.devBtnTxt, dispositivoSel === id && { color: config.color }]}>
                  {d.nombre ?? id}
                </Text>
                <Text style={s.devBtnCiudad}>{d.ciudad ?? '—'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {haySinDatos ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTxt}>📡 Sin purificadores registrados</Text>
            <Text style={s.emptySub}>Ve a Dispositivos → Agregar purificador</Text>
          </View>
        ) : sinDatos ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTxt}>Esperando datos del sensor...</Text>
          </View>
        ) : (
          <>
            {/* ── Card principal de riesgo personal ── */}
            <View style={[s.riesgoCard, { borderColor: colorNivel + '40' }]}>
              <View style={s.riesgoTop}>
                <View style={[s.riesgoBadge, { backgroundColor: colorNivel + '20' }]}>
                  <Text style={[s.riesgoBadgeTxt, { color: colorNivel }]}>
                    {nivelEmoji[nivel]}  {nivelLabel[nivel]}
                  </Text>
                </View>
                {gasProblema && (
                  <Text style={[s.riesgoGas, { color: colorNivel }]}>
                    Gas crítico: {gasProblema}
                  </Text>
                )}
              </View>

              <View style={s.riesgoMetrics}>
                <View style={s.metricBox}>
                  <Text style={s.metricVal}>{tiempoSeguro}</Text>
                  <Text style={s.metricLabel}>Exposición segura</Text>
                </View>
                <View style={[s.metricDivider]} />
                <View style={s.metricBox}>
                  <Text style={[s.metricVal, { color: colorNivel }]}>{score}/100</Text>
                  <Text style={s.metricLabel}>Índice de salud</Text>
                </View>
                <View style={s.metricDivider} />
                <View style={s.metricBox}>
                  <Text style={s.metricVal}>{datosSel?.gas_critico ?? 'Ninguno'}</Text>
                  <Text style={s.metricLabel}>Gas crítico</Text>
                </View>
              </View>

              <ScoreBar score={score} color={colorNivel} />
            </View>

            {/* ── Gases relevantes para tu condición ── */}
            <Text style={s.sectionTitle}>Gases de riesgo para {config.label.toLowerCase()}</Text>
            <View style={s.gasCard}>
              <GasBar
                label="CO₂ (Dióxido de carbono)"
                valor={gases.co2}
                warn={config.thresholds.co2.warn}
                danger={config.thresholds.co2.danger}
                unidad="ppm"
                colorGas={C.co2}
              />
              <GasBar
                label="CO (Monóxido de carbono)"
                valor={gases.co}
                warn={config.thresholds.co.warn}
                danger={config.thresholds.co.danger}
                unidad="ppm"
                colorGas={C.co}
              />
              <GasBar
                label="NH₃ (Amoniaco)"
                valor={gases.nh3}
                warn={config.thresholds.nh3.warn}
                danger={config.thresholds.nh3.danger}
                unidad="ppm"
                colorGas={C.nh3}
              />
              <Text style={s.gasNote}>▲ Marca = tu umbral personalizado según tu condición</Text>
            </View>

            {/* ── Plan de acción personalizado ── */}
            <Text style={s.sectionTitle}>Plan de acción ahora mismo</Text>
            <View style={[s.accionCard, { borderColor: colorNivel + '40' }]}>
              <View style={[s.accionHeader, { backgroundColor: colorNivel + '15' }]}>
                <Text style={[s.accionHeaderTxt, { color: colorNivel }]}>
                  {nivelEmoji[nivel]}  {nivelLabel[nivel]} — {config.label}
                </Text>
              </View>
              {acciones.map((a, i) => (
                <AccionItem key={i} texto={a} index={i} />
              ))}
            </View>

            {/* ── Actividades recomendadas ── */}
            <Text style={s.sectionTitle}>Actividades</Text>
            <View style={s.actGrid}>
              {actividades.map((a) => {
                const col = a.ok ? '#22D3A0' : '#EF4444';
                return (
                  <View key={a.titulo} style={[s.actCard, { borderColor: col + '30' }]}>
                    <View style={[s.actIcon, { backgroundColor: col + '15' }]}>
                      <Text style={s.actEmoji}>{a.emoji}</Text>
                    </View>
                    <Text style={s.actTitulo}>{a.titulo}</Text>
                    <Text style={[s.actStatus, { color: col }]}>
                      {a.ok ? 'Permitido' : 'No recomendado'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* ── Todos mis purificadores ── */}
            {Object.keys(dispositivos).length > 0 && (
              <>
                <Text style={s.sectionTitle}>Mis purificadores</Text>
                {Object.entries(dispositivos).map(([id, d]) => {
                  const cal   = (d.calidad_aire ?? '').toLowerCase() as NivelRiesgo;
                  const col   = nivelColor[cal] ?? '#4A5B6E';
                  const gases2 = { co2: d.co2_ppm ?? 0, co: d.co_ppm ?? 0, nh3: d.nh3_ppm ?? 0 };
                  const { nivel: niv2 } = calcularRiesgoPersonal(gases2, config);
                  const colPers = nivelColor[niv2];
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setDispositivoSel(id)}
                      style={[s.dispositivoCard, dispositivoSel === id && { borderColor: config.color + '80' }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.dispositivoNombre}>{d.nombre ?? id}</Text>
                        <Text style={s.dispositivoGases}>
                          CO₂: {(d.co2_ppm ?? 0).toFixed(0)} · CO: {(d.co_ppm ?? 0).toFixed(1)} · NH₃: {(d.nh3_ppm ?? 0).toFixed(1)} ppm
                        </Text>
                        {d.ultima_actualizacion && (
                          <Text style={s.dispositivoTs}>
                            Actualizado: {d.ultima_actualizacion.split(' ')[1] ?? d.ultima_actualizacion}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={[s.calBadge, { backgroundColor: col + '20' }]}>
                          <Text style={[s.calBadgeTxt, { color: col }]}>
                            {d.calidad_aire ? d.calidad_aire.charAt(0).toUpperCase() + d.calidad_aire.slice(1) : '—'}
                          </Text>
                        </View>
                        <View style={[s.calBadge, { backgroundColor: colPers + '15' }]}>
                          <Text style={[s.calBadgeTxt, { color: colPers, fontSize: 9 }]}>
                            Para ti: {nivelLabel[niv2]}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ESTILOS
// ═══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  scroll:  { padding: 16, paddingBottom: 40 },

  // Perfil
  perfilCard:     { backgroundColor: C.bgCard, borderRadius: R.lg, borderWidth: 1, padding: 16, marginBottom: 12 },
  perfilTop:      { flexDirection: 'row', gap: 14, alignItems: 'center' },
  perfilIconBox:  { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  perfilEmoji:    { fontSize: 28 },
  perfilSub:      { fontSize: 10, color: C.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  perfilLabel:    { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  perfilHint:     { fontSize: 10, color: C.textMuted, marginTop: 3 },

  // Selector dispositivo
  devBtn:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.sm, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, marginRight: 8, alignItems: 'center' },
  devBtnTxt:      { fontSize: 12, fontWeight: '800', color: C.textMuted },
  devBtnCiudad:   { fontSize: 10, color: C.textMuted, marginTop: 2 },

  // Empty
  emptyCard:  { backgroundColor: C.bgCard, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 32, alignItems: 'center', marginBottom: 16 },
  emptyTxt:   { color: C.textSecondary, fontSize: 14, fontWeight: '700' },
  emptySub:   { color: C.textMuted, fontSize: 12, marginTop: 6 },

  // Riesgo principal
  riesgoCard:    { backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, padding: 18, marginBottom: 16, elevation: 4 },
  riesgoTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  riesgoBadge:   { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  riesgoBadgeTxt:{ fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  riesgoGas:     { fontSize: 11, fontWeight: '800' },
  riesgoMetrics: { flexDirection: 'row', marginBottom: 16 },
  metricBox:     { flex: 1, alignItems: 'center' },
  metricVal:     { fontSize: 18, fontWeight: '900', color: C.textPrimary, letterSpacing: -0.5 },
  metricLabel:   { fontSize: 10, color: C.textMuted, marginTop: 3, textAlign: 'center' },
  metricDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 4 },

  // Score bar
  scoreRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, marginTop: 12 },
  scoreLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  scoreNum:   { fontSize: 13, fontWeight: '900' },
  scoreTrack: { height: 8, backgroundColor: C.bgElevated, borderRadius: 4, overflow: 'hidden' },
  scoreFill:  { height: 8, borderRadius: 4 },

  // Sección
  sectionTitle: { fontSize: 12, fontWeight: '800', color: C.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },

  // Gas bars
  gasCard:      { backgroundColor: C.bgCard, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  gasRow:       { marginBottom: 14 },
  gasHeader:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  gasLabel:     { fontSize: 11, color: C.textSecondary, fontWeight: '700' },
  gasVal:       { fontSize: 13, fontWeight: '900' },
  gasUnit:      { fontSize: 10, fontWeight: '400', color: C.textMuted },
  gasTrack:     { height: 7, backgroundColor: C.bgElevated, borderRadius: 4, overflow: 'visible', position: 'relative' },
  gasFill:      { height: 7, borderRadius: 4 },
  warnMarker:   { position: 'absolute', top: -3, width: 2, height: 13, backgroundColor: '#F59E0B', borderRadius: 1 },
  gasThreshold: { fontSize: 9, color: C.textMuted, marginTop: 4, fontWeight: '600' },
  gasNote:      { fontSize: 9, color: C.textMuted, marginTop: 6, fontStyle: 'italic' },

  // Plan de acción
  accionCard:       { backgroundColor: C.bgCard, borderRadius: R.lg, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  accionHeader:     { paddingHorizontal: 16, paddingVertical: 12 },
  accionHeaderTxt:  { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  accionRow:        { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  accionNum:        { width: 22, height: 22, borderRadius: 11, backgroundColor: C.bgElevated, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  accionNumTxt:     { fontSize: 10, fontWeight: '900', color: C.textSecondary },
  accionTxt:        { flex: 1, fontSize: 13, color: C.textPrimary, lineHeight: 19 },

  // Actividades
  actGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actCard:   { width: '47%', backgroundColor: C.bgCard, borderRadius: R.md, borderWidth: 1, padding: 14, alignItems: 'center' },
  actIcon:   { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actEmoji:  { fontSize: 22 },
  actTitulo: { fontSize: 11, fontWeight: '700', color: C.textSecondary, textAlign: 'center', marginBottom: 4 },
  actStatus: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  // Dispositivos
  dispositivoCard:   { backgroundColor: C.bgCard, borderRadius: R.md, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  dispositivoNombre: { fontSize: 14, fontWeight: '800', color: C.textPrimary },
  dispositivoGases:  { fontSize: 11, color: C.textMuted, marginTop: 3 },
  dispositivoTs:     { fontSize: 10, color: C.textMuted, marginTop: 2 },
  calBadge:          { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  calBadgeTxt:       { fontSize: 10, fontWeight: '800' },
});
