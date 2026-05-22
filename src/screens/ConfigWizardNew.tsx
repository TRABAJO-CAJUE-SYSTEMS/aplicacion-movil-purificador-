// ═══════════════════════════════════════════════════════════════
//  ConfigWizard — BLE Configuration Wizard para PurificadorIA
//  Reemplaza el ConfigWizard antiguo en DispositivosScreen.tsx
// ═══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Switch,
  ScrollView, ActivityIndicator, Alert, Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database, ref, set } from '../firebaseConfig';
import { useBleManager, DEVICE_NAME } from '../hooks/useBleManager';

// ── Tipos ──────────────────────────────────────────────────────
type WizardStep =
  | 'scan' | 'conectando' | 'dashboard'
  | 'wifi' | 'ubicacion' | 'pines' | 'calibracion' | 'umbrales'
  | 'guardando' | 'exito';

interface ConfigState {
  deviceId: string; deviceName: string; rssi: number;
  modificado: { wifi: boolean; ubicacion: boolean; pines: boolean; calibracion: boolean; umbrales: boolean };
  wifi_ssid: string; wifi_pass: string;
  ciudad: string; departamento: string; pais: string;
  latitud: number; longitud: number; altitud: number;
  pin_mq7: number; pin_mq135: number; pin_relay: number;
  pin_led_red: number; pin_led_yellow: number; pin_led_green: number;
  ro_mq7: number; ro_mq135: number; rl_mq7: number; rl_mq135: number;
  usar_ia: boolean; tiempo_calentamiento: number;
  intervalo_sensor: number; intervalo_firebase: number;
  co_bueno: number; co_moderado: number; co_peligro: number;
  co2_bueno: number; co2_moderado: number; co2_peligro: number;
  nh3_moderado: number; nh3_peligro: number;
}

const DEFAULT_CONFIG: ConfigState = {
  deviceId: '', deviceName: '', rssi: -100,
  modificado: { wifi: false, ubicacion: false, pines: false, calibracion: false, umbrales: false },
  wifi_ssid: '', wifi_pass: '',
  ciudad: 'cochabamba', departamento: 'cochabamba', pais: 'Bolivia',
  latitud: -17.3935, longitud: -66.1570, altitud: 2558,
  pin_mq7: 35, pin_mq135: 34, pin_relay: 5,
  pin_led_red: 16, pin_led_yellow: 17, pin_led_green: 18,
  ro_mq7: 27.5, ro_mq135: 41.0, rl_mq7: 10.0, rl_mq135: 20.0,
  usar_ia: true, tiempo_calentamiento: 180000,
  intervalo_sensor: 3000, intervalo_firebase: 15000,
  co_bueno: 8.7, co_moderado: 30.0, co_peligro: 87.0,
  co2_bueno: 1000, co2_moderado: 1500, co2_peligro: 2500,
  nh3_moderado: 25, nh3_peligro: 50,
};

const CIUDADES_BO = [
  { label: 'La Paz',     id: 'la_paz',     lat: -16.5000, lon: -68.1500, alt: 3640 },
  { label: 'Cochabamba', id: 'cochabamba', lat: -17.3935, lon: -66.1570, alt: 2558 },
  { label: 'Santa Cruz', id: 'santa_cruz', lat: -17.7833, lon: -63.1821, alt: 416  },
  { label: 'Oruro',      id: 'oruro',      lat: -17.9667, lon: -67.1167, alt: 3706 },
  { label: 'Potosí',     id: 'potosi',     lat: -19.5836, lon: -65.7531, alt: 3967 },
  { label: 'Sucre',      id: 'sucre',      lat: -19.0430, lon: -65.2591, alt: 2810 },
  { label: 'Tarija',     id: 'tarija',     lat: -21.5355, lon: -64.7296, alt: 1866 },
  { label: 'Trinidad',   id: 'trinidad',   lat: -14.8333, lon: -64.9000, alt: 155  },
  { label: 'Cobija',     id: 'cobija',     lat: -11.0283, lon: -68.7667, alt: 255  },
];

const ADC_PINS = [32, 33, 34, 35, 36, 39];
const STORAGE_KEY = 'purificador_config_last';

// ── Helpers ────────────────────────────────────────────────────
function signalBars(rssi: number): string {
  if (rssi > -60) return '▂▄▆█';
  if (rssi > -80) return '▂▄▆░';
  return '▂▄░░';
}

function signalColor(rssi: number): string {
  if (rssi > -60) return '#4CAF50';
  if (rssi > -80) return '#FF9800';
  return '#F44336';
}

// ── Componente PinSelector ─────────────────────────────────────
function PinSelector({
  label, value, isADC, allValues, onChange,
}: {
  label: string; value: number; isADC: boolean;
  allValues: number[]; onChange: (v: number) => void;
}) {
  const isDuplicate = allValues.filter(v => v === value).length > 1;
  const isWrongADC  = isADC && !ADC_PINS.includes(value);
  return (
    <View style={wStyles.pinRow}>
      <Text style={wStyles.pinLabel}>{label}</Text>
      <View style={wStyles.pinControls}>
        <TouchableOpacity style={wStyles.pinBtn} onPress={() => onChange(Math.max(0, value - 1))}>
          <Text style={wStyles.pinBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={wStyles.pinValue}>{value}</Text>
        <TouchableOpacity style={wStyles.pinBtn} onPress={() => onChange(Math.min(39, value + 1))}>
          <Text style={wStyles.pinBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {isDuplicate && <View style={wStyles.badgeRed}><Text style={wStyles.badgeText}>⚠ Duplicado</Text></View>}
      {isWrongADC  && <View style={wStyles.badgeAmb}><Text style={wStyles.badgeText}>⚠ Solo ADC</Text></View>}
    </View>
  );
}

// ── Componente GasSliders ──────────────────────────────────────
function GasSliders({
  title, color, keys, labels, mins, maxs, cfg, onChange,
}: {
  title: string; color: string;
  keys: string[]; labels: string[];
  mins: number[]; maxs: number[];
  cfg: ConfigState; onChange: (k: string, v: number) => void;
}) {
  const vals = keys.map(k => (cfg as any)[k] as number);
  return (
    <View style={[wStyles.gasSection, { borderColor: color + '30' }]}>
      <Text style={[wStyles.gasTitle, { color }]}>{title}</Text>
      {/* Barra visual 3 segmentos */}
      <View style={wStyles.barContainer}>
        <View style={[wStyles.barSeg, { backgroundColor: '#4CAF50', flex: vals[0] }]} />
        <View style={[wStyles.barSeg, { backgroundColor: '#FF9800', flex: Math.max(vals[1] - vals[0], 1) }]} />
        <View style={[wStyles.barSeg, { backgroundColor: '#F44336', flex: Math.max(maxs[2] - vals[1], 1) }]} />
      </View>
      {keys.map((k, i) => (
        <View key={k} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={wStyles.sliderLabel}>{labels[i]}</Text>
            <Text style={[wStyles.sliderVal, { color }]}>{vals[i].toFixed(vals[i] < 10 ? 1 : 0)} ppm</Text>
          </View>
          <Slider
            minimumValue={mins[i]} maximumValue={maxs[i]}
            step={vals[i] < 10 ? 0.1 : 1}
            value={vals[i]}
            minimumTrackTintColor={color}
            maximumTrackTintColor="#eee"
            thumbTintColor={color}
            onValueChange={(v) => {
              // Validar orden bueno < moderado < peligroso
              if (i === 0 && v >= vals[1]) onChange(keys[1], v + (vals[i] < 10 ? 1 : 10));
              if (i === 1 && v <= vals[0]) onChange(keys[0], v - (vals[i] < 10 ? 1 : 10));
              if (i === 1 && v >= vals[2]) onChange(keys[2], v + (vals[i] < 10 ? 1 : 10));
              onChange(k, v);
            }}
          />
        </View>
      ))}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
//  CONFIG WIZARD — componente principal
// ════════════════════════════════════════════════════════════════
export default function ConfigWizard({ onClose }: { onClose: () => void }) {
  const [step,        setStep]        = useState<WizardStep>('scan');
  const [cfg,         setCfg]         = useState<ConfigState>(DEFAULT_CONFIG);
  const [showPass,    setShowPass]    = useState(false);
  const [reiniciando, setReiniciando] = useState(false);
  const [statusMsg,   setStatusMsg]   = useState('');
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const ble = useBleManager();

  // Cargar config guardada
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((s) => {
      if (s) setCfg(prev => ({ ...prev, ...JSON.parse(s) }));
    }).catch(() => {});
  }, []);

  // Animación punto BLE
  useEffect(() => {
    if (step === 'dashboard') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
    return () => blinkAnim.stopAnimation();
  }, [step]);

  const updateCfg = useCallback((updates: Partial<ConfigState>) => {
    setCfg(prev => ({ ...prev, ...updates }));
  }, []);

  const markModified = useCallback((section: keyof ConfigState['modificado']) => {
    setCfg(prev => ({
      ...prev,
      modificado: { ...prev.modificado, [section]: true },
    }));
  }, []);

  const totalModificado = Object.values(cfg.modificado).filter(Boolean).length;

  // ── Guardar y enviar por BLE ──────────────────────────────
  const handleGuardarTodo = async () => {
    setStep('guardando');
    setStatusMsg('Enviando configuración al purificador...');
    try {
      const payload = {
        wifi_ssid:            cfg.wifi_ssid,
        wifi_pass:            cfg.wifi_pass,
        ciudad:               cfg.ciudad,
        departamento:         cfg.departamento,
        pais:                 cfg.pais,
        latitud:              cfg.latitud,
        longitud:             cfg.longitud,
        altitud:              cfg.altitud,
        pin_mq7:              cfg.pin_mq7,
        pin_mq135:            cfg.pin_mq135,
        pin_relay:            cfg.pin_relay,
        pin_led_red:          cfg.pin_led_red,
        pin_led_yellow:       cfg.pin_led_yellow,
        pin_led_green:        cfg.pin_led_green,
        ro_mq7:               cfg.ro_mq7,
        ro_mq135:             cfg.ro_mq135,
        rl_mq7:               cfg.rl_mq7,
        rl_mq135:             cfg.rl_mq135,
        co_bueno:             cfg.co_bueno,
        co_moderado:          cfg.co_moderado,
        co_peligro:           cfg.co_peligro,
        co2_bueno:            cfg.co2_bueno,
        co2_moderado:         cfg.co2_moderado,
        co2_peligro:          cfg.co2_peligro,
        nh3_moderado:         cfg.nh3_moderado,
        nh3_peligro:          cfg.nh3_peligro,
        intervalo_sensor:     cfg.intervalo_sensor,
        intervalo_firebase:   cfg.intervalo_firebase,
        usar_ia:              cfg.usar_ia,
        tiempo_calentamiento: cfg.tiempo_calentamiento,
      };

      const response = await ble.sendConfig(payload);

      // Guardar en AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      // Guardar en Firebase
      const key = cfg.deviceName.replace(/[^a-zA-Z0-9]/g, '_') || 'dispositivo';
      await set(ref(database, `config_dispositivos/${key}`), {
        ...payload,
        guardado_el: new Date().toISOString(),
        dispositivo: cfg.deviceName,
      });

      if (response.status === 'ok') {
        setReiniciando(response.reiniciando ?? false);
        setStep('exito');
      } else {
        Alert.alert('Error del dispositivo', response.msg ?? 'Error desconocido');
        setStep('dashboard');
      }
    } catch (e: any) {
      Alert.alert('Error BLE', e.message ?? 'No se pudo enviar la configuración', [
        { text: 'Reintentar', onPress: handleGuardarTodo },
        { text: 'Volver',     onPress: () => setStep('dashboard') },
      ]);
    }
  };

  // ══════════════════════════════════════════════════════════
  //  RENDER POR STEP
  // ══════════════════════════════════════════════════════════

  // ── SCAN ─────────────────────────────────────────────────
  if (step === 'scan') return (
    <View style={wStyles.container}>
      <WizardHeader title="Buscar purificador" onClose={onClose} />
      <ScrollView contentContainerStyle={wStyles.body}>
        <TouchableOpacity
          style={[wStyles.primaryBtn, (ble.scanning || ble.connecting) && { backgroundColor: '#ccc' }]}
          onPress={ble.scanning ? ble.stopScan : ble.startScan}
          disabled={ble.connecting}
        >
          <Text style={wStyles.primaryBtnText}>
            {ble.connecting ? '🔗 Conectando...' : ble.scanning ? '⏹ Detener búsqueda' : '🔍 Iniciar búsqueda Bluetooth'}
          </Text>
        </TouchableOpacity>

        {ble.scanning && (
          <View style={wStyles.scanningRow}>
            <ActivityIndicator color="#007F7A" />
            <Text style={wStyles.scanningText}>
              Buscando dispositivos BLE... ({ble.devices.length} encontrado{ble.devices.length !== 1 ? 's' : ''})
            </Text>
          </View>
        )}

        {ble.error && (
          <View style={wStyles.errorBox}>
            <Text style={wStyles.errorText}>⚠ {ble.error}</Text>
            <TouchableOpacity onPress={ble.startScan} style={wStyles.retryBtn}>
              <Text style={wStyles.retryBtnText}>🔄 Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!ble.scanning && !ble.connecting && ble.devices.length === 0 && !ble.error && (
          <View style={wStyles.emptyBox}>
            <Text style={wStyles.emptyText}>
              {'No se encontró ningún purificador.\n¿Está en modo configuración?\n\nPresiona BOOT del ESP32 durante 3 s — el LED amarillo debe parpadear.\n\nSi el LED parpadea y no aparece, asegúrate de que el nombre BLE del ESP32 sea "PurificadorIA".'}
            </Text>
          </View>
        )}

        {ble.devices.map((d) => {
          const isTarget = d.name === DEVICE_NAME;
          return (
            <View key={d.id}
              style={[wStyles.deviceItem, isTarget && { borderColor: '#007F7A', borderWidth: 1.5 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isTarget && <View style={wStyles.targetBadge}><Text style={wStyles.targetBadgeText}>Purificador</Text></View>}
                  <Text style={wStyles.deviceItemName}>{d.name}</Text>
                </View>
                <Text style={[wStyles.deviceItemRssi, { color: signalColor(d.rssi) }]}>
                  {signalBars(d.rssi)} {d.rssi} dBm
                </Text>
              </View>
              <TouchableOpacity
                style={wStyles.connectBtn}
                onPress={async () => {
                  updateCfg({ deviceId: d.id, deviceName: d.name, rssi: d.rssi });
                  setStep('conectando');
                  const device = await ble.connect(d.id);
                  if (device) {
                    setStep('dashboard');
                  } else {
                    // ble.error ya tiene el mensaje de error; volver a scan
                    setStep('scan');
                  }
                }}
              >
                <Text style={wStyles.connectBtnText}>Conectar</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── CONECTANDO ────────────────────────────────────────────
  if (step === 'conectando') return (
    <View style={[wStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#007F7A" />
      <Text style={wStyles.centeredTitle}>Conectando a{'\n'}{cfg.deviceName}...</Text>
      {ble.error && (
        <View style={wStyles.errorBox}>
          <Text style={wStyles.errorText}>{ble.error}</Text>
          <TouchableOpacity onPress={() => setStep('scan')} style={wStyles.retryBtn}>
            <Text style={wStyles.retryBtnText}>Volver al escaneo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── DASHBOARD ─────────────────────────────────────────────
  if (step === 'dashboard') return (
    <View style={wStyles.container}>
      <WizardHeader title="Configurar purificador" onClose={onClose} />
      {/* Indicador BLE */}
      <View style={wStyles.bleIndicator}>
        <Animated.View style={[wStyles.bleDot, { opacity: blinkAnim }]} />
        <Text style={wStyles.bleText}>{cfg.deviceName} — conectado</Text>
      </View>
      <Text style={wStyles.sectionLabel}>ELIGE QUÉ CONFIGURAR</Text>
      <ScrollView contentContainerStyle={wStyles.dashBody}>
        {[
          { icon: '📶', title: 'WiFi',       desc: 'Red y contraseña de internet',    key: 'wifi',        step: 'wifi'        },
          { icon: '📍', title: 'Ubicación',  desc: 'Ciudad, país y coordenadas GPS',  key: 'ubicacion',   step: 'ubicacion'   },
          { icon: '🔌', title: 'Pines GPIO', desc: 'Asignar pines del ESP32',         key: 'pines',       step: 'pines'       },
          { icon: '🔬', title: 'Calibración',desc: 'Sensores MQ y tiempos',           key: 'calibracion', step: 'calibracion' },
          { icon: '⚠️', title: 'Umbrales',   desc: 'Niveles CO, CO₂ y NH₃',          key: 'umbrales',    step: 'umbrales'    },
        ].map(({ icon, title, desc, key, step: s }) => {
          const mod = cfg.modificado[key as keyof typeof cfg.modificado];
          return (
            <TouchableOpacity key={key} style={[wStyles.dashCard, mod && { borderColor: '#007F7A40' }]}
              onPress={() => setStep(s as WizardStep)}>
              <Text style={wStyles.dashIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={wStyles.dashCardTitle}>{title}</Text>
                <Text style={wStyles.dashCardDesc}>{desc}</Text>
              </View>
              {mod && <View style={wStyles.modDot}><Text style={wStyles.modDotText}>✓</Text></View>}
              <Text style={{ color: '#aaa', fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Botón flotante GUARDAR TODO */}
      <TouchableOpacity style={wStyles.saveTodoBtn} onPress={handleGuardarTodo}>
        {totalModificado > 0 && (
          <View style={wStyles.saveBadge}><Text style={wStyles.saveBadgeText}>{totalModificado}</Text></View>
        )}
        <Text style={wStyles.saveTodoBtnText}>💾  GUARDAR TODO</Text>
      </TouchableOpacity>
    </View>
  );

  // ── WIFI ──────────────────────────────────────────────────
  if (step === 'wifi') return (
    <View style={wStyles.container}>
      <WizardHeader title="📶 Configuración WiFi" onBack={() => setStep('dashboard')} onClose={onClose} />
      <ScrollView contentContainerStyle={wStyles.body}>
        <View style={wStyles.formCard}>
          <Text style={wStyles.fieldLabel}>Nombre de la red (SSID)</Text>
          <TextInput style={wStyles.input} placeholder="MiWiFi_Casa"
            value={cfg.wifi_ssid} onChangeText={(v) => updateCfg({ wifi_ssid: v })}
            autoCapitalize="none" />
          <Text style={wStyles.fieldLabel}>Contraseña</Text>
          <View style={{ position: 'relative' }}>
            <TextInput style={wStyles.input} placeholder="••••••••"
              value={cfg.wifi_pass} onChangeText={(v) => updateCfg({ wifi_pass: v })}
              secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={wStyles.eyeBtn}>
              <Text style={wStyles.eyeText}>{showPass ? 'OCULTAR' : 'VER'}</Text>
            </TouchableOpacity>
          </View>
          <View style={wStyles.infoBox}>
            <Text style={wStyles.infoText}>
              ℹ El ESP32 solo se reinicia si el WiFi cambia. Cambiar solo umbrales o calibración no requiere reinicio.
            </Text>
          </View>
        </View>
        <TouchableOpacity style={wStyles.primaryBtn} onPress={() => { markModified('wifi'); setStep('dashboard'); }}>
          <Text style={wStyles.primaryBtnText}>✓ Guardar esta sección</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── UBICACION ─────────────────────────────────────────────
  if (step === 'ubicacion') return (
    <View style={wStyles.container}>
      <WizardHeader title="📍 Ubicación del purificador" onBack={() => setStep('dashboard')} onClose={onClose} />
      <ScrollView contentContainerStyle={wStyles.body}>
        {/* Selector rápido de ciudades */}
        <Text style={wStyles.fieldLabel}>Ciudad rápida</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {CIUDADES_BO.map((c) => (
            <TouchableOpacity key={c.id}
              style={[wStyles.cityChip, cfg.ciudad === c.id && wStyles.cityChipActive]}
              onPress={() => updateCfg({
                ciudad: c.id, departamento: c.id,
                latitud: c.lat, longitud: c.lon, altitud: c.alt,
              })}>
              <Text style={[wStyles.cityChipText, cfg.ciudad === c.id && { color: '#007F7A', fontWeight: '800' }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={wStyles.formCard}>
          {[
            { label: 'Ciudad',       key: 'ciudad'       },
            { label: 'Departamento', key: 'departamento' },
            { label: 'País',         key: 'pais'         },
          ].map(({ label, key }) => (
            <View key={key}>
              <Text style={wStyles.fieldLabel}>{label}</Text>
              <TextInput style={wStyles.input} value={(cfg as any)[key]}
                onChangeText={(v) => updateCfg({ [key]: v } as any)} />
            </View>
          ))}
          <Text style={wStyles.fieldLabel}>Altitud (metros)</Text>
          <TextInput style={wStyles.input} keyboardType="numeric"
            value={cfg.altitud.toString()}
            onChangeText={(v) => updateCfg({ altitud: parseFloat(v) || 0 })} />
          <Text style={wStyles.fieldLabel}>Latitud</Text>
          <TextInput style={wStyles.input} keyboardType="numbers-and-punctuation"
            value={cfg.latitud.toString()}
            onChangeText={(v) => updateCfg({ latitud: parseFloat(v) || 0 })} />
          <Text style={wStyles.fieldLabel}>Longitud</Text>
          <TextInput style={wStyles.input} keyboardType="numbers-and-punctuation"
            value={cfg.longitud.toString()}
            onChangeText={(v) => updateCfg({ longitud: parseFloat(v) || 0 })} />
        </View>

        <View style={wStyles.coordPreview}>
          <Text style={wStyles.coordText}>
            📍 {cfg.latitud.toFixed(4)}, {cfg.longitud.toFixed(4)} · {cfg.altitud}m
          </Text>
        </View>

        <TouchableOpacity style={wStyles.primaryBtn} onPress={() => { markModified('ubicacion'); setStep('dashboard'); }}>
          <Text style={wStyles.primaryBtnText}>✓ Guardar esta sección</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── PINES ─────────────────────────────────────────────────
  if (step === 'pines') return (
    <View style={wStyles.container}>
      <WizardHeader title="🔌 Pines GPIO del ESP32" onBack={() => setStep('dashboard')} onClose={onClose} />
      <ScrollView contentContainerStyle={wStyles.body}>
        <View style={wStyles.formCard}>
          <PinSelector label="MQ-135 (CO₂/NH₃)" value={cfg.pin_mq135} isADC={true}
            allValues={[cfg.pin_mq135, cfg.pin_mq7, cfg.pin_relay, cfg.pin_led_red, cfg.pin_led_yellow, cfg.pin_led_green]}
            onChange={(v) => updateCfg({ pin_mq135: v })} />
          <PinSelector label="MQ-7 (CO)" value={cfg.pin_mq7} isADC={true}
            allValues={[cfg.pin_mq135, cfg.pin_mq7, cfg.pin_relay, cfg.pin_led_red, cfg.pin_led_yellow, cfg.pin_led_green]}
            onChange={(v) => updateCfg({ pin_mq7: v })} />
          <PinSelector label="Relay extractor" value={cfg.pin_relay} isADC={false}
            allValues={[cfg.pin_mq135, cfg.pin_mq7, cfg.pin_relay, cfg.pin_led_red, cfg.pin_led_yellow, cfg.pin_led_green]}
            onChange={(v) => updateCfg({ pin_relay: v })} />
          <PinSelector label="LED Rojo" value={cfg.pin_led_red} isADC={false}
            allValues={[cfg.pin_mq135, cfg.pin_mq7, cfg.pin_relay, cfg.pin_led_red, cfg.pin_led_yellow, cfg.pin_led_green]}
            onChange={(v) => updateCfg({ pin_led_red: v })} />
          <PinSelector label="LED Amarillo" value={cfg.pin_led_yellow} isADC={false}
            allValues={[cfg.pin_mq135, cfg.pin_mq7, cfg.pin_relay, cfg.pin_led_red, cfg.pin_led_yellow, cfg.pin_led_green]}
            onChange={(v) => updateCfg({ pin_led_yellow: v })} />
          <PinSelector label="LED Verde" value={cfg.pin_led_green} isADC={false}
            allValues={[cfg.pin_mq135, cfg.pin_mq7, cfg.pin_relay, cfg.pin_led_red, cfg.pin_led_yellow, cfg.pin_led_green]}
            onChange={(v) => updateCfg({ pin_led_green: v })} />
        </View>
        <View style={[wStyles.infoBox, { borderColor: '#FF980040' }]}>
          <Text style={[wStyles.infoText, { color: '#FF9800' }]}>
            ⚠ Cambiar pines reiniciará el ESP32 automáticamente.
          </Text>
        </View>
        <Text style={wStyles.hintText}>Pines ADC válidos: 32, 33, 34, 35, 36, 39</Text>
        <TouchableOpacity style={wStyles.primaryBtn} onPress={() => { markModified('pines'); setStep('dashboard'); }}>
          <Text style={wStyles.primaryBtnText}>✓ Guardar esta sección</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── CALIBRACION ───────────────────────────────────────────
  if (step === 'calibracion') return (
    <View style={wStyles.container}>
      <WizardHeader title="🔬 Calibración de sensores" onBack={() => setStep('dashboard')} onClose={onClose} />
      <ScrollView contentContainerStyle={wStyles.body}>

        {/* MQ-7 */}
        <Text style={wStyles.subSectionTitle}>Sensor MQ-7 — Monóxido de Carbono</Text>
        <View style={wStyles.formCard}>
          <Text style={wStyles.fieldLabel}>Ro en aire limpio: {cfg.ro_mq7.toFixed(1)} kΩ</Text>
          <Slider minimumValue={1} maximumValue={100} step={0.5}
            value={cfg.ro_mq7} minimumTrackTintColor="#007F7A" maximumTrackTintColor="#eee" thumbTintColor="#007F7A"
            onValueChange={(v) => updateCfg({ ro_mq7: Math.round(v * 10) / 10 })} />
          <Text style={wStyles.fieldLabel}>RL resistencia carga (kΩ)</Text>
          <TextInput style={wStyles.input} keyboardType="decimal-pad"
            value={cfg.rl_mq7.toString()} onChangeText={(v) => updateCfg({ rl_mq7: parseFloat(v) || 10 })} />
        </View>

        {/* MQ-135 */}
        <Text style={wStyles.subSectionTitle}>Sensor MQ-135 — CO₂ / NH₃</Text>
        <View style={wStyles.formCard}>
          <Text style={wStyles.fieldLabel}>Ro en aire limpio: {cfg.ro_mq135.toFixed(1)} kΩ</Text>
          <Slider minimumValue={1} maximumValue={100} step={0.5}
            value={cfg.ro_mq135} minimumTrackTintColor="#007F7A" maximumTrackTintColor="#eee" thumbTintColor="#007F7A"
            onValueChange={(v) => updateCfg({ ro_mq135: Math.round(v * 10) / 10 })} />
          <Text style={wStyles.fieldLabel}>RL resistencia carga (kΩ)</Text>
          <TextInput style={wStyles.input} keyboardType="decimal-pad"
            value={cfg.rl_mq135.toString()} onChangeText={(v) => updateCfg({ rl_mq135: parseFloat(v) || 20 })} />
        </View>

        {/* Modo IA */}
        <Text style={wStyles.subSectionTitle}>Modo de clasificación</Text>
        <View style={[wStyles.formCard, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={wStyles.fieldLabel}>Usar IA (Edge Impulse v4)</Text>
            {!cfg.usar_ia && <View style={wStyles.badgeAmb}><Text style={wStyles.badgeText}>Modo: Umbrales OMS/OSHA</Text></View>}
          </View>
          <Switch value={cfg.usar_ia} onValueChange={(v) => updateCfg({ usar_ia: v })}
            trackColor={{ false: '#eee', true: '#00AFAA80' }} thumbColor={cfg.usar_ia ? '#007F7A' : '#aaa'} />
        </View>

        {/* Tiempos */}
        <Text style={wStyles.subSectionTitle}>Tiempos de operación</Text>
        <View style={wStyles.formCard}>
          <Text style={wStyles.fieldLabel}>Tiempo de calentamiento</Text>
          <View style={wStyles.chipRow}>
            {[
              { label: '1 min',  ms: 60000  },
              { label: '3 min',  ms: 180000 },
              { label: '10 min', ms: 600000 },
              { label: '30 min', ms: 1800000},
            ].map(({ label, ms }) => (
              <TouchableOpacity key={ms}
                style={[wStyles.chip, cfg.tiempo_calentamiento === ms && wStyles.chipActive]}
                onPress={() => updateCfg({ tiempo_calentamiento: ms })}>
                <Text style={[wStyles.chipText, cfg.tiempo_calentamiento === ms && { color: '#007F7A', fontWeight: '800' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={wStyles.fieldLabel}>Intervalo lectura sensores: {(cfg.intervalo_sensor / 1000).toFixed(0)}s</Text>
          <Slider minimumValue={1000} maximumValue={30000} step={1000}
            value={cfg.intervalo_sensor} minimumTrackTintColor="#007F7A" maximumTrackTintColor="#eee" thumbTintColor="#007F7A"
            onValueChange={(v) => updateCfg({ intervalo_sensor: v })} />

          <Text style={wStyles.fieldLabel}>Intervalo subida Firebase: {(cfg.intervalo_firebase / 1000).toFixed(0)}s</Text>
          <Slider minimumValue={5000} maximumValue={300000} step={5000}
            value={cfg.intervalo_firebase} minimumTrackTintColor="#007F7A" maximumTrackTintColor="#eee" thumbTintColor="#007F7A"
            onValueChange={(v) => updateCfg({ intervalo_firebase: v })} />
        </View>

        <View style={wStyles.tipBox}>
          <Text style={wStyles.tipTitle}>💡 ¿Cómo calibrar el Ro?</Text>
          <Text style={wStyles.tipText}>
            Deja el sensor 24-48h al aire libre y mide la resistencia con un multímetro entre AO y GND.
            Ese valor es tu Ro.
          </Text>
        </View>

        <TouchableOpacity style={wStyles.primaryBtn} onPress={() => { markModified('calibracion'); setStep('dashboard'); }}>
          <Text style={wStyles.primaryBtnText}>✓ Guardar esta sección</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── UMBRALES ──────────────────────────────────────────────
  if (step === 'umbrales') return (
    <View style={wStyles.container}>
      <WizardHeader title="⚠️ Umbrales de Calidad del Aire" onBack={() => setStep('dashboard')} onClose={onClose} />
      <ScrollView contentContainerStyle={wStyles.body}>

        <GasSliders title="CO — Monóxido de Carbono" color="#f97316"
          keys={['co_bueno', 'co_moderado', 'co_peligro']}
          labels={['Bueno hasta', 'Moderado hasta', 'Peligroso desde']}
          mins={[0, 0, 0]} maxs={[50, 100, 200]} cfg={cfg}
          onChange={(k, v) => updateCfg({ [k]: v } as any)} />

        <GasSliders title="CO₂ — Dióxido de Carbono" color="#818cf8"
          keys={['co2_bueno', 'co2_moderado', 'co2_peligro']}
          labels={['Bueno hasta', 'Moderado hasta', 'Peligroso desde']}
          mins={[400, 400, 400]} maxs={[2000, 3000, 5000]} cfg={cfg}
          onChange={(k, v) => updateCfg({ [k]: v } as any)} />

        <GasSliders title="NH₃ — Amoníaco" color="#a78bfa"
          keys={['nh3_moderado', 'nh3_peligro']}
          labels={['Moderado desde', 'Peligroso desde']}
          mins={[0, 0]} maxs={[100, 200]} cfg={cfg}
          onChange={(k, v) => updateCfg({ [k]: v } as any)} />

        <TouchableOpacity style={[wStyles.primaryBtn, { backgroundColor: '#f5f5f5', marginBottom: 8 }]}
          onPress={() => updateCfg({
            co_bueno: 8.7, co_moderado: 30, co_peligro: 87,
            co2_bueno: 1000, co2_moderado: 1500, co2_peligro: 2500,
            nh3_moderado: 25, nh3_peligro: 50,
          })}>
          <Text style={[wStyles.primaryBtnText, { color: '#555' }]}>🔄 Restaurar valores OMS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={wStyles.primaryBtn} onPress={() => { markModified('umbrales'); setStep('dashboard'); }}>
          <Text style={wStyles.primaryBtnText}>✓ Guardar esta sección</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── GUARDANDO ─────────────────────────────────────────────
  if (step === 'guardando') return (
    <View style={[wStyles.container, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
      <ActivityIndicator size="large" color="#007F7A" />
      <Text style={wStyles.centeredTitle}>Enviando configuración al purificador...</Text>
      <Text style={wStyles.centeredSub}>No cierres la app · puede tardar hasta 30 segundos</Text>
    </View>
  );

  // ── EXITO ─────────────────────────────────────────────────
  if (step === 'exito') return (
    <View style={[wStyles.container, wStyles.successContainer]}>
      <View style={wStyles.successCircle}>
        <Text style={wStyles.successCheck}>✓</Text>
      </View>
      <Text style={wStyles.successTitle}>¡Configuración guardada!</Text>

      {reiniciando && (
        <View style={wStyles.rebootBadge}>
          <Text style={wStyles.rebootText}>🔄 Dispositivo reiniciando... (5-10 seg)</Text>
        </View>
      )}

      {/* Resumen de secciones modificadas */}
      <View style={wStyles.summaryCard}>
        {Object.entries(cfg.modificado).filter(([, v]) => v).map(([k]) => {
          const labels: Record<string, string> = {
            wifi: '📶 WiFi', ubicacion: '📍 Ubicación', pines: '🔌 Pines GPIO',
            calibracion: '🔬 Calibración', umbrales: '⚠️ Umbrales',
          };
          return (
            <View key={k} style={wStyles.summaryRow}>
              <Text style={wStyles.summaryText}>{labels[k] ?? k}</Text>
              <Text style={wStyles.summaryCheck}>✓</Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={wStyles.primaryBtn} onPress={() => { ble.disconnect(); onClose(); }}>
        <Text style={wStyles.primaryBtnText}>Ver mis dispositivos →</Text>
      </TouchableOpacity>
    </View>
  );

  return null;
}

// ── WizardHeader ───────────────────────────────────────────────
function WizardHeader({ title, onBack, onClose }: {
  title: string; onBack?: () => void; onClose: () => void;
}) {
  return (
    <View style={wStyles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={wStyles.backBtn}>
          <Text style={wStyles.backBtnText}>‹ Atrás</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 64 }} />}
      <Text style={wStyles.headerTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={wStyles.closeBtn}>
        <Text style={wStyles.closeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Estilos del wizard ─────────────────────────────────────────
const wStyles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#f5f5f5' },
  body:              { padding: 16, paddingBottom: 40 },
  dashBody:          { padding: 16, paddingBottom: 100 },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', elevation: 2 },
  headerTitle:       { flex: 1, fontSize: 15, fontWeight: '800', color: '#333', textAlign: 'center' },
  backBtn:           { width: 64 },
  backBtnText:       { color: '#007F7A', fontWeight: '700', fontSize: 14 },
  closeBtn:          { width: 40, alignItems: 'flex-end' },
  closeBtnText:      { color: '#F44336', fontWeight: '700', fontSize: 16 },
  sectionLabel:      { fontSize: 11, fontWeight: '800', color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  subSectionTitle:   { fontSize: 13, fontWeight: '800', color: '#007F7A', marginTop: 14, marginBottom: 6 },
  primaryBtn:        { backgroundColor: '#007F7A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, elevation: 2 },
  primaryBtnText:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  formCard:          { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2 },
  fieldLabel:        { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6, marginTop: 6 },
  input:             { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  eyeBtn:            { position: 'absolute', right: 12, top: 14 },
  eyeText:           { color: '#aaa', fontSize: 11, fontWeight: '700' },
  infoBox:           { backgroundColor: '#f0fffe', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#00AFAA30', marginBottom: 12 },
  infoText:          { fontSize: 12, color: '#00AFAA', lineHeight: 18 },
  tipBox:            { backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FF980030', marginBottom: 14 },
  tipTitle:          { fontSize: 13, fontWeight: '800', color: '#FF9800', marginBottom: 6 },
  tipText:           { fontSize: 12, color: '#a16207', lineHeight: 18 },
  hintText:          { fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 8 },
  // BLE indicator
  bleIndicator:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  bleDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00AFAA' },
  bleText:           { fontSize: 12, color: '#00AFAA', fontWeight: '700' },
  // Scan
  scanningRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  scanningText:      { color: '#555', fontSize: 13 },
  errorBox:          { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText:         { color: '#DC2626', fontSize: 13 },
  emptyBox:          { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', elevation: 1, marginTop: 12 },
  emptyText:         { color: '#aaa', fontSize: 13, textAlign: 'center', lineHeight: 22 },
  deviceItem:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#f0f0f0' },
  deviceItemName:    { fontSize: 14, fontWeight: '700', color: '#333' },
  deviceItemRssi:    { fontSize: 11, marginTop: 2, fontFamily: 'monospace' },
  targetBadge:       { backgroundColor: '#007F7A20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  targetBadgeText:   { fontSize: 10, fontWeight: '800', color: '#007F7A' },
  connectBtn:        { backgroundColor: '#007F7A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  connectBtnText:    { color: '#fff', fontWeight: '800', fontSize: 13 },
  // Dashboard
  dashCard:          { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  dashIcon:          { fontSize: 26 },
  dashCardTitle:     { fontSize: 15, fontWeight: '800', color: '#333' },
  dashCardDesc:      { fontSize: 12, color: '#aaa', marginTop: 2 },
  modDot:            { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00AFAA', alignItems: 'center', justifyContent: 'center' },
  modDotText:        { color: '#fff', fontSize: 11, fontWeight: '800' },
  saveTodoBtn:       { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#007F7A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 8 },
  saveTodoBtnText:   { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  saveBadge:         { position: 'absolute', top: -8, right: 16, backgroundColor: '#F44336', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  saveBadgeText:     { color: '#fff', fontSize: 11, fontWeight: '800' },
  // Pines
  pinRow:            { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 },
  pinLabel:          { fontSize: 13, color: '#444', flex: 1, minWidth: 120 },
  pinControls:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinBtn:            { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  pinBtnText:        { fontSize: 18, color: '#333', lineHeight: 20 },
  pinValue:          { fontSize: 18, fontWeight: '900', color: '#333', minWidth: 32, textAlign: 'center' },
  badgeRed:          { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeAmb:          { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:         { fontSize: 10, fontWeight: '700', color: '#555' },
  // Ciudad chips
  cityChip:          { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: '#eee' },
  cityChipActive:    { backgroundColor: '#00AFAA15', borderColor: '#007F7A' },
  cityChipText:      { fontSize: 13, color: '#666' },
  // Gas sliders
  gasSection:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, elevation: 1, borderWidth: 1 },
  gasTitle:          { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  sliderLabel:       { fontSize: 12, color: '#555' },
  sliderVal:         { fontSize: 12, fontWeight: '800' },
  barContainer:      { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', marginBottom: 12 },
  barSeg:            { height: 8 },
  // Chips
  chipRow:           { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  chip:              { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#eee' },
  chipActive:        { backgroundColor: '#00AFAA15', borderColor: '#007F7A' },
  chipText:          { fontSize: 13, color: '#666' },
  // Coords
  coordPreview:      { backgroundColor: '#f0fffe', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#00AFAA30' },
  coordText:         { fontSize: 13, color: '#007F7A', fontWeight: '700', fontFamily: 'monospace' },
  // Success
  successContainer:  { justifyContent: 'center', alignItems: 'center', padding: 20, gap: 16 },
  successCircle:     { width: 90, height: 90, borderRadius: 28, backgroundColor: '#00AFAA15', borderWidth: 1.5, borderColor: '#00AFAA40', alignItems: 'center', justifyContent: 'center' },
  successCheck:      { fontSize: 44, color: '#00AFAA' },
  successTitle:      { fontSize: 22, fontWeight: '900', color: '#333' },
  rebootBadge:       { backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#FF980040' },
  rebootText:        { color: '#FF9800', fontWeight: '700', fontSize: 13 },
  summaryCard:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, width: '100%', elevation: 1 },
  summaryRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  summaryText:       { fontSize: 13, color: '#444' },
  summaryCheck:      { color: '#00AFAA', fontWeight: '800' },
  // Centered
  centeredTitle:     { fontSize: 18, fontWeight: '800', color: '#333', textAlign: 'center', marginTop: 16 },
  centeredSub:       { fontSize: 13, color: '#aaa', textAlign: 'center' },
  retryBtn:          { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginTop: 10, alignItems: 'center' },
  retryBtnText:      { color: '#007F7A', fontWeight: '700' },
});
