import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  Animated, StatusBar, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         sendPasswordResetEmail, signInWithGoogleToken,
         resendVerificationEmail } from '../firebaseConfig';
import { C, R } from '../theme';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '864375202936-edi9idi7qge9705gj1n83mev0ll6pr6h.apps.googleusercontent.com';
const GOOGLE_REDIRECT_URI  = 'https://auth.expo.io/@juamky/airpure-app';

export default function LoginScreen() {
  const [isLogin,      setIsLogin]      = useState(true);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [name,         setName]         = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [googleLoading,setGoogleLoading]= useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Google auth request
  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId:  GOOGLE_WEB_CLIENT_ID,
    redirectUri:  GOOGLE_REDIRECT_URI,
  });

  // Manejar respuesta de Google OAuth
  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') {
      setGoogleLoading(false);
      if (response.type === 'error') {
        Alert.alert('Error', response.error?.message ?? 'Error en Google Sign-In');
      }
      return;
    }
    const { authentication } = response;
    const token    = authentication?.idToken ?? authentication?.accessToken;
    const tokType  = authentication?.idToken ? 'id_token' : 'access_token';
    if (!token) { setGoogleLoading(false); return; }
    signInWithGoogleToken(token, tokType as any)
      .then(() => navigation.reset({ index: 0, routes: [{ name: 'BottomTabs' }] }))
      .catch((e: any) => Alert.alert('Error', e.message ?? 'Error al iniciar sesión con Google'))
      .finally(() => setGoogleLoading(false));
  }, [response]);

  // Fade in al cargar
  const fade = useRef(new Animated.Value(0)).current;
  const slide= useRef(new Animated.Value(40)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        navigation.reset({ index: 0, routes: [{ name: 'BottomTabs' }] });
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        setIsLogin(true);
        Alert.alert(
          'Cuenta creada',
          'Te enviamos un correo de verificación. Haz clic en el link antes de iniciar sesión.\n\n(Revisa también la carpeta de spam)'
        );
      }
    } catch (e: any) {
      if (e.code === 'auth/email-not-verified') {
        Alert.alert(
          'Correo no verificado',
          'Revisa tu bandeja de entrada y haz clic en el link de verificación.\n\n¿No lo recibiste?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Reenviar correo',
              onPress: async () => {
                try {
                  await resendVerificationEmail();
                  Alert.alert('Enviado', 'Revisa tu correo (también la carpeta de spam).');
                } catch {
                  Alert.alert('Error', 'No se pudo reenviar. Intenta de nuevo.');
                }
              },
            },
          ]
        );
        return;
      }
      const msgs: Record<string, string> = {
        'auth/invalid-email':        'Correo inválido',
        'auth/user-not-found':       'No existe una cuenta con ese correo',
        'auth/wrong-password':       'Contraseña incorrecta',
        'auth/email-already-in-use': 'Ese correo ya está registrado',
        'auth/weak-password':        'La contraseña debe tener al menos 6 caracteres',
        'INVALID_LOGIN_CREDENTIALS': 'Correo o contraseña incorrectos',
      };
      Alert.alert('Error', msgs[e.code] ?? e.message ?? 'Error de autenticación');
    } finally { setLoading(false); }
  };

  const handleForgot = async () => {
    if (!email) { alert('Ingresa tu correo primero'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); alert('Revisa tu correo.'); }
    catch (e: any) { alert(e.message); }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const result = await promptAsync();
    if (result?.type !== 'success') setGoogleLoading(false);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Fondo decorativo */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>

            {/* Logo */}
            <View style={styles.logoBlock}>
              <View style={styles.logoMark}>
                <Text style={styles.logoLetter}>A</Text>
              </View>
              <Text style={styles.logoName}>AirMonitoring</Text>
              <Text style={styles.logoSub}>Sistema IoT de Purificación Inteligente</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {['Iniciar Sesión', 'Registrarse'].map((tab, i) => {
                const active = (i === 0) === isLogin;
                return (
                  <TouchableOpacity key={tab} style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setIsLogin(i === 0)}>
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Form */}
            <View style={styles.form}>
              {!isLogin && (
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>NOMBRE</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName}
                    placeholder="Tu nombre" placeholderTextColor={C.textMuted} />
                </View>
              )}
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>CORREO</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail}
                  placeholder="correo@ejemplo.com" placeholderTextColor={C.textMuted}
                  keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>CONTRASEÑA</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput style={styles.input} value={password} onChangeText={setPassword}
                    placeholder="••••••••" placeholderTextColor={C.textMuted}
                    secureTextEntry={!showPass} />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                    <Text style={styles.eyeText}>{showPass ? 'OCULTAR' : 'VER'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isLogin && (
                <TouchableOpacity onPress={handleForgot} style={{ alignSelf: 'flex-end', marginBottom: 4 }}>
                  <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, (!email || !password || loading) && { opacity: 0.5 }]}
                onPress={handleSubmit} disabled={!email || !password || loading}>
                <Text style={styles.submitText}>{loading ? 'Cargando...' : isLogin ? 'Ingresar →' : 'Crear cuenta →'}</Text>
              </TouchableOpacity>
            </View>

            {/* Google Sign-In */}
            <View style={styles.divider}>
              <View style={styles.divLine} /><Text style={styles.divText}>o</Text><View style={styles.divLine} />
            </View>
            <TouchableOpacity
              style={[styles.googleBtn, googleLoading && { opacity: 0.6 }]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={C.textPrimary} size="small" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleText}>Continuar con Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Mapa público */}
            <View style={[styles.divider, { marginTop: 12 }]}>
              <View style={styles.divLine} /><Text style={styles.divText}>o</Text><View style={styles.divLine} />
            </View>
            <TouchableOpacity style={styles.publicBtn} onPress={() => navigation.navigate('MapaPublico')}>
              <Text style={styles.publicBtnText}>🗺  Ver mapa de calidad del aire sin cuenta</Text>
            </TouchableOpacity>

            <Text style={styles.footer}>Universidad Franz Tamayo · Bolivia 2026</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, padding: 24, justifyContent: 'center' },
  // Orbs de fondo
  orb1:         { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: C.teal + '08', top: -80, right: -80 },
  orb2:         { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: C.co2 + '06', bottom: 100, left: -60 },
  // Logo
  logoBlock:    { alignItems: 'center', marginBottom: 36, marginTop: 20 },
  logoMark:     { width: 60, height: 60, borderRadius: 18, backgroundColor: C.tealDim, borderWidth: 1.5, borderColor: C.tealBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoLetter:   { color: C.teal, fontSize: 32, fontWeight: '900' },
  logoName:     { color: C.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  logoSub:      { color: C.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
  // Tabs
  tabs:         { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: R.sm, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive:    { backgroundColor: C.bgElevated },
  tabText:      { color: C.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive:{ color: C.textPrimary },
  // Form
  form:         { backgroundColor: C.bgCard, borderRadius: R.xl, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  inputWrap:    { marginBottom: 14 },
  inputLabel:   { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  input:        { backgroundColor: C.bgInput, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.border },
  eyeBtn:       { position: 'absolute', right: 12, top: 14 },
  eyeText:      { color: C.textMuted, fontSize: 10, fontWeight: '800' },
  forgotText:   { color: C.teal, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  submitBtn:    { backgroundColor: C.teal, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitText:   { color: C.bg, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  // Divider
  divider:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  divLine:      { flex: 1, height: 1, backgroundColor: C.border },
  divText:      { color: C.textMuted, fontSize: 12 },
  // Google
  googleBtn:    { backgroundColor: '#ffffff10', borderRadius: R.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#ffffff25', marginBottom: 4 },
  googleIcon:   { color: '#EA4335', fontSize: 18, fontWeight: '900', width: 22, textAlign: 'center' },
  googleText:   { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  // Público
  publicBtn:    { backgroundColor: C.bgCard, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 24 },
  publicBtnText:{ color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  footer:       { textAlign: 'center', color: C.textMuted, fontSize: 11 },
});
