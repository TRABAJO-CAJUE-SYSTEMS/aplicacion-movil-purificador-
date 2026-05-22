import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

import InicioScreen       from '../screens/InicioScreen';
import MapaScreen         from '../screens/MapaScreen';
import SaludScreen        from '../screens/SaludScreen';
import IAScreen           from '../screens/IAScreen';
import HistorialScreen    from '../screens/HistorialScreen';
import AlertasScreen      from '../screens/AlertasScreen';
import ZonasInteresScreen from '../screens/ZonasInteresScreen';
import DispositivosScreen from '../screens/DispositivosScreen';
import AjustesScreen      from '../screens/AjustesScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Inicio',       label: 'Inicio',    svg: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', component: InicioScreen },
  { name: 'Mapa',         label: 'Mapa',      svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', component: MapaScreen },
  { name: 'Salud',        label: 'Salud',     svg: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z', component: SaludScreen },
  { name: 'IA',           label: 'IA',        svg: 'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z', component: IAScreen },
  { name: 'Historial',    label: 'Datos',     svg: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z', component: HistorialScreen },
  { name: 'Alertas',      label: 'Alertas',   svg: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z', component: AlertasScreen },
  { name: 'Zonas',        label: 'Zonas',     svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', component: ZonasInteresScreen },
  { name: 'Dispositivos', label: 'Dispos.',   svg: 'M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v2h18v-2h-4z', component: DispositivosScreen },
  { name: 'Ajustes',      label: 'Ajustes',   svg: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z', component: AjustesScreen },
];

// ── Ícono SVG nativo (sin vector-icons) ───────────────────
function SvgIcon({ path, size = 22, color }: { path: string; size?: number; color: string }) {
  const { Svg, Path } = require('react-native-svg');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={path} />
    </Svg>
  );
}

// ── Tab icon con animación ─────────────────────────────────
function TabIcon({ tab, focused }: { tab: typeof TABS[0]; focused: boolean }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const opacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.1 : 1,
        useNativeDriver: true,
        damping: 15, stiffness: 300,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={tabStyles.iconWrapper}>
      {/* Pill indicador activo */}
      <Animated.View style={[tabStyles.pill, { opacity }]} />

      <Animated.View style={[tabStyles.iconInner, { transform: [{ scale }] }]}>
        <SvgIcon
          path={tab.svg}
          size={20}
          color={focused ? C.teal : C.textMuted}
        />
      </Animated.View>

      <Text style={[
        tabStyles.label,
        { color: focused ? C.teal : C.textMuted },
      ]}>
        {tab.label}
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    paddingTop: 4,
  },
  pill: {
    position: 'absolute',
    top: -8,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.teal,
  },
  iconInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

export default function BottomTabsNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={({ route }) => {
        const tab = TABS.find(t => t.name === route.name)!;
        return {
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: C.bgCard,
            borderTopColor: C.border,
            borderTopWidth: 1,
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 4,
            elevation: 20,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: -4 },
            shadowRadius: 12,
          },
          tabBarIcon: ({ focused }) => <TabIcon tab={tab} focused={focused} />,
        };
      }}
    >
      {TABS.map(t => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}
