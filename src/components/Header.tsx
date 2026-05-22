import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, R } from '../theme';
import { auth } from '../firebaseConfig';
import { signOut } from '../customAuth';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: { icon: string; onPress: () => void };
}

export default function Header({ title = 'Inicio', subtitle, showBack = false, rightAction }: HeaderProps) {
  const navigation = useNavigation<any>();

  const initials = auth.currentUser?.email?.slice(0, 2).toUpperCase() ?? 'AI';

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.header}>

        {/* Left */}
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>A</Text>
            </View>
          )}
          <View style={{ marginLeft: showBack ? 4 : 10 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        {/* Right */}
        <View style={styles.right}>
          {rightAction && (
            <TouchableOpacity style={styles.iconBtn} onPress={rightAction.onPress}>
              <Text style={styles.iconBtnText}>{rightAction.icon}</Text>
            </TouchableOpacity>
          )}
          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Ajustes')}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 52;

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.bg,
    paddingTop: PT,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  left:       { flexDirection: 'row', alignItems: 'center', flex: 1 },
  right:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Logo mark
  logoMark:   { width: 32, height: 32, borderRadius: 10, backgroundColor: C.tealDim, borderWidth: 1, borderColor: C.tealBorder, alignItems: 'center', justifyContent: 'center' },
  logoText:   { color: C.teal, fontSize: 16, fontWeight: '900' },
  // Título
  title:      { fontSize: 20, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subtitle:   { fontSize: 11, color: C.textMuted, marginTop: 1, fontWeight: '600' },
  // Back
  backBtn:    { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  backArrow:  { color: C.teal, fontSize: 18, fontWeight: '700', marginTop: -1 },
  // Botón ícono
  iconBtn:    { width: 38, height: 38, borderRadius: 12, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:{ fontSize: 16 },
  // Avatar
  avatar:     { width: 38, height: 38, borderRadius: 12, backgroundColor: C.tealDim, borderWidth: 1, borderColor: C.tealBorder, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.teal, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
});
