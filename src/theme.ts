// ══════════════════════════════════════════════════════════
//  AirMonitoring — Design System v3.0
//  Estética: "Dark Industrial Precision"
//  AQI: 6 niveles según escala internacional EPA
// ══════════════════════════════════════════════════════════

export const C = {
  // Fondos
  bg:          '#0A0E13',
  bgCard:      '#111720',
  bgElevated:  '#161E28',
  bgInput:     '#0D1219',
  bgGlass:     'rgba(17,23,32,0.95)',

  // Acentos primarios
  teal:        '#00C9BE',
  tealDim:     '#00C9BE30',
  tealBorder:  '#00C9BE50',

  // Acentos de estado
  green:       '#22D3A0',
  greenDim:    '#22D3A015',
  amber:       '#F59E0B',
  amberDim:    '#F59E0B15',
  red:         '#EF4444',
  redDim:      '#EF444415',

  // Gases
  co2:         '#818CF8',   // violeta
  co:          '#FB923C',   // naranja
  nh3:         '#A78BFA',   // lila
  pm25:        '#F43F5E',   // rosa-rojo (partículas)
  cov:         '#06B6D4',   // cyan (compuestos orgánicos volátiles)

  // Texto
  textPrimary:   '#F0F4F8',
  textSecondary: '#8A9BB0',
  textMuted:     '#4A5B6E',

  // Bordes
  border:        '#1E2A38',
  borderLight:   '#243040',
} as const;

export const R = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

// ── AQI 6 niveles (escala EPA / PM2.5) ──────────────────────
export const AQI_LEVELS = {
  bueno:               { color: '#22D3A0', dim: '#22D3A015', label: 'Bueno',                   range: '0–12 μg/m³',   emoji: '✓'  },
  moderado:            { color: '#FCD34D', dim: '#FCD34D15', label: 'Moderado',                range: '12–35 μg/m³',  emoji: '!'  },
  insalubre_sensibles: { color: '#FB923C', dim: '#FB923C15', label: 'Insalubre (sensibles)',    range: '35–55 μg/m³',  emoji: '⚠'  },
  insalubre:           { color: '#F87171', dim: '#F8717115', label: 'Insalubre',                range: '55–150 μg/m³', emoji: '⚠'  },
  muy_insalubre:       { color: '#C084FC', dim: '#C084FC15', label: 'Muy Insalubre',            range: '150–250 μg/m³', emoji: '☣' },
  peligroso:           { color: '#F43F5E', dim: '#F43F5E15', label: 'Peligroso',               range: '250+ μg/m³',   emoji: '🚨' },
} as const;

export type AqiKey = keyof typeof AQI_LEVELS;

// Calcula nivel AQI desde valor de PM2.5 (μg/m³)
export function aqiFromPM25(pm25: number): AqiKey {
  if (pm25 <= 12)  return 'bueno';
  if (pm25 <= 35)  return 'moderado';
  if (pm25 <= 55)  return 'insalubre_sensibles';
  if (pm25 <= 150) return 'insalubre';
  if (pm25 <= 250) return 'muy_insalubre';
  return 'peligroso';
}

// Helpers: aceptan tanto los 3 niveles del ESP32 como los 6 de la escala AQI
export function aqiColor(calidad: string): string {
  const k = (calidad ?? '').toLowerCase() as AqiKey;
  return AQI_LEVELS[k]?.color ?? C.textMuted;
}
export function aqiDim(calidad: string): string {
  const k = (calidad ?? '').toLowerCase() as AqiKey;
  return AQI_LEVELS[k]?.dim ?? C.bgCard;
}
export function aqiLabel(calidad: string): string {
  const k = (calidad ?? '').toLowerCase() as AqiKey;
  return AQI_LEVELS[k]?.label ?? 'Sin datos';
}
export function aqiEmoji(calidad: string): string {
  const k = (calidad ?? '').toLowerCase() as AqiKey;
  return AQI_LEVELS[k]?.emoji ?? '?';
}
