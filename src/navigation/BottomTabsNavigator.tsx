import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Modal, Pressable, Dimensions,
} from 'react-native';
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
const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
//  4 tabs principales (el 5º slot es el botón "Más")
// ─────────────────────────────────────────────────────────────────
const PRIMARY_TABS = [
  {
    name: 'Inicio',
    label: 'Inicio',
    svg: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    component: InicioScreen,
  },
  {
    name: 'Alertas',
    label: 'Alertas',
    svg: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    component: AlertasScreen,
  },
  {
    name: 'IA',
    label: 'IA',
    svg: 'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z',
    component: IAScreen,
  },
  {
    name: 'Dispositivos',
    label: 'Dispos.',
    svg: 'M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v2h18v-2h-4z',
    component: DispositivosScreen,
  },
] as const;

// Todos los screens registrados en el navigator (incluyendo los ocultos)
const ALL_SCREENS = [
  ...PRIMARY_TABS,
  { name: 'Mapa',      component: MapaScreen         },
  { name: 'Salud',     component: SaludScreen        },
  { name: 'Historial', component: HistorialScreen    },
  { name: 'Zonas',     component: ZonasInteresScreen },
  { name: 'Ajustes',   component: AjustesScreen      },
] as const;

// Nombres de tabs primarios para comparación rápida
const PRIMARY_NAMES = new Set(PRIMARY_TABS.map(t => t.name));

// Items del menú "Más"
const MORE_ITEMS = [
  { name: 'Mapa',      label: 'Mapa',     emoji: '🗺',  desc: 'Calidad del aire'  },
  { name: 'Salud',     label: 'Salud',    emoji: '❤️',  desc: 'Recomendaciones'   },
  { name: 'Historial', label: 'Datos',    emoji: '📊',  desc: 'Historial de gases' },
  { name: 'Zonas',     label: 'Zonas',    emoji: '📍',  desc: 'Zonas de interés'  },
  { name: 'Ajustes',   label: 'Ajustes',  emoji: '⚙️',  desc: 'Configuración'     },
] as const;

// ─────────────────────────────────────────────────────────────────
//  Ícono SVG nativo
// ─────────────────────────────────────────────────────────────────
function SvgIcon({ path, size = 22, color }: { path: string; size?: number; color: string }) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Svg, Path } = require('react-native-svg');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d={path} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
//  TabIcon — ícono de un tab con animación
// ─────────────────────────────────────────────────────────────────
function TabIcon({ tab, focused }: { tab: typeof PRIMARY_TABS[number]; focused: boolean }) {
  const scale   = useRef(new Animated.Value(focused ? 1.1 : 1)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,     { toValue: focused ? 1.1 : 1, useNativeDriver: true, damping: 14, stiffness: 280 }),
      Animated.timing(bgOpacity, { toValue: focused ? 1 : 0,   duration: 180,         useNativeDriver: true }),
    ]).start();
  }, [focused]);

  const isIA = tab.name === 'IA';

  if (isIA) {
    return (
      <View style={ts.iaWrapper}>
        <Animated.View style={[ts.iaCircle, focused && ts.iaCircleFocused, { transform: [{ scale }] }]}>
          <SvgIcon path={tab.svg} size={22} color={focused ? '#fff' : C.teal} />
        </Animated.View>
        <Text style={[ts.iaLabel, { color: focused ? C.teal : C.textMuted }]}>IA</Text>
      </View>
    );
  }

  return (
    <View style={ts.iconWrapper}>
      <Animated.View style={[ts.iconBg, { opacity: bgOpacity }]} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <SvgIcon path={tab.svg} size={21} color={focused ? C.teal : C.textMuted} />
      </Animated.View>
      <Text style={[ts.label, { color: focused ? C.teal : C.textMuted }]}>
        {tab.label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Botón "Más" en la tab bar
// ─────────────────────────────────────────────────────────────────
function MasButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, damping: 8, stiffness: 300 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 8, stiffness: 300 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity style={ts.masBtn} onPress={handlePress} activeOpacity={1}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <View style={ts.masIconBox}>
          <Text style={ts.masDotsText}>•••</Text>
        </View>
        <Text style={ts.masLabel}>Más</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Menú "Más" — bottom sheet con animación
// ─────────────────────────────────────────────────────────────────
function MasSheet({
  visible, onClose, onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (name: string) => void;
}) {
  const [rendered, setRendered] = useState(false);
  const slideY  = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }),
        Animated.timing(opacity, { toValue: 1, duration: 220,         useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,  { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <Modal transparent animationType="none" visible={rendered} onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[ms.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[ms.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={ms.handle} />
        <Text style={ms.title}>Más pantallas</Text>

        <View style={ms.grid}>
          {MORE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={ms.card}
              activeOpacity={0.72}
              onPress={() => {
                onClose();
                // Pequeño delay para que la animación de cierre inicie antes de navegar
                setTimeout(() => onNavigate(item.name), 80);
              }}
            >
              <Text style={ms.cardEmoji}>{item.emoji}</Text>
              <Text style={ms.cardLabel}>{item.label}</Text>
              <Text style={ms.cardDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Tab bar personalizada
// ─────────────────────────────────────────────────────────────────
function CustomTabBar({
  state, descriptors, navigation, insets, onMasPress,
}: {
  state: any; descriptors: any; navigation: any;
  insets: { bottom: number };
  onMasPress: () => void;
}) {
  // Solo renderizar los 4 tabs primarios
  const primaryRoutes = state.routes.filter((r: any) => PRIMARY_NAMES.has(r.name));

  return (
    <View style={[bs.bar, { paddingBottom: insets.bottom, height: 64 + insets.bottom }]}>
      {primaryRoutes.map((route: any, idx: number) => {
        const focused = state.routes[state.index]?.name === route.name;
        const tab = PRIMARY_TABS.find(t => t.name === route.name)!;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        // Insertar botón "Más" antes del último tab (Dispositivos)
        const insertMasBefore = idx === primaryRoutes.length - 1;

        return (
          <React.Fragment key={route.key}>
            {insertMasBefore && <MasButton onPress={onMasPress} />}
            <TouchableOpacity
              style={bs.item}
              onPress={onPress}
              activeOpacity={0.85}
            >
              <TabIcon tab={tab} focused={focused} />
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Navegador principal
// ─────────────────────────────────────────────────────────────────
export default function BottomTabsNavigator() {
  const insets = useSafeAreaInsets();
  const [masVisible, setMasVisible] = useState(false);
  const navRef = useRef<any>(null);

  return (
    <>
      <Tab.Navigator
        initialRouteName="Inicio"
        screenOptions={{ headerShown: false, tabBarShowLabel: false }}
        tabBar={(props) => {
          // Guardar referencia de navegación para usarla desde el sheet
          navRef.current = props.navigation;
          return (
            <CustomTabBar
              {...props}
              insets={insets}
              onMasPress={() => setMasVisible(true)}
            />
          );
        }}
      >
        {/* Tabs primarios */}
        {PRIMARY_TABS.map(t => (
          <Tab.Screen key={t.name} name={t.name} component={t.component} />
        ))}

        {/* Pantallas ocultas de la tab bar — accesibles vía "Más" */}
        <Tab.Screen name="Mapa"      component={MapaScreen}         options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Salud"     component={SaludScreen}        options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Historial" component={HistorialScreen}    options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Zonas"     component={ZonasInteresScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Ajustes"   component={AjustesScreen}      options={{ tabBarButton: () => null }} />
      </Tab.Navigator>

      <MasSheet
        visible={masVisible}
        onClose={() => setMasVisible(false)}
        onNavigate={(name) => navRef.current?.navigate(name)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Estilos — tab icons
// ─────────────────────────────────────────────────────────────────
const ts = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    paddingTop: 8,
    width: 56,
    minHeight: 52,
  },
  iconBg: {
    position: 'absolute',
    top: 6,
    width: 46,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.tealDim,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
    letterSpacing: 0.2,
  },
  // IA — botón circular contenido dentro de la barra (sin overflow)
  iaWrapper: {
    alignItems: 'center',
    paddingTop: 6,
    width: 56,
    minHeight: 52,
  },
  iaCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.tealBorder,
    backgroundColor: C.tealDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iaCircleFocused: {
    backgroundColor: C.teal,
    borderColor: C.teal,
    shadowColor: C.teal,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 6,
  },
  iaLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  // Botón "Más"
  masBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    paddingTop: 8,
    minHeight: 52,
  },
  masIconBox: {
    width: 46,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masDotsText: {
    fontSize: 13,
    color: C.textMuted,
    letterSpacing: 2,
    lineHeight: 16,
  },
  masLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    marginTop: 5,
    letterSpacing: 0.2,
  },
});

// ─────────────────────────────────────────────────────────────────
//  Estilos — barra inferior
// ─────────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.bgCard,
    borderTopWidth: 1,
    borderTopColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 14,
    elevation: 22,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────
//  Estilos — sheet "Más"
// ─────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.bgCard,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.border,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.textMuted + '55',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: C.textMuted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: (width - 40 - 10) / 2,
    backgroundColor: C.bgElevated,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardEmoji: {
    fontSize: 28,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: C.textPrimary,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: C.textMuted,
  },
});
