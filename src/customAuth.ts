/**
 * Firebase Auth via REST API — sin módulos nativos
 * Funciona en Expo Go, emuladores y producción
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY  = "AIzaSyB_lHSk7tsVKKp4h4bRK8-OJJMC63ZOoak";
const BASE     = "https://identitytoolkit.googleapis.com/v1/accounts";
const AUTH_KEY = 'airpure_auth_user';

type CurrentUser = { email: string; uid: string; idToken?: string };

// Objeto auth mutable — simula FirebaseAuth
export const auth = {
  currentUser: null as CurrentUser | null,
};

function mapError(msg: string): string {
  const map: Record<string, string> = {
    'EMAIL_NOT_FOUND':             'auth/user-not-found',
    'INVALID_PASSWORD':            'auth/wrong-password',
    'EMAIL_EXISTS':                'auth/email-already-in-use',
    'WEAK_PASSWORD':               'auth/weak-password',
    'INVALID_EMAIL':               'auth/invalid-email',
    'USER_DISABLED':               'auth/user-disabled',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'auth/too-many-requests',
    'INVALID_LOGIN_CREDENTIALS':   'auth/invalid-credentials',
  };
  // Firebase puede retornar "CÓDIGO : descripción"
  const key = msg.split(' : ')[0].trim();
  return map[key] ?? msg;
}

async function firebasePost(endpoint: string, body: object) {
  const res = await fetch(`${BASE}:${endpoint}?key=${API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) {
    const code = mapError(data.error.message ?? 'UNKNOWN');
    throw { code, message: data.error.message };
  }
  return data;
}

async function saveUser(user: CurrentUser) {
  auth.currentUser = user;
  // No guardar idToken en AsyncStorage (es de corta duración)
  const { idToken: _, ...toSave } = user;
  try { await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(toSave)); } catch {}
}

// ── Verificación de correo ────────────────────────────────────────────────────

async function isEmailVerified(idToken: string): Promise<boolean> {
  const data = await firebasePost('lookup', { idToken });
  return data.users?.[0]?.emailVerified === true;
}

export async function sendEmailVerification(idToken: string) {
  await firebasePost('sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken,
  });
}

// Reenviar correo de verificación al usuario actualmente autenticado
export async function resendVerificationEmail() {
  if (!auth.currentUser?.idToken) throw { code: 'auth/no-token', message: 'Sin sesión activa' };
  await sendEmailVerification(auth.currentUser.idToken);
}

// ── Funciones principales ─────────────────────────────────────────────────────

export async function restoreSession() {
  try {
    const saved = await AsyncStorage.getItem(AUTH_KEY);
    if (saved) auth.currentUser = JSON.parse(saved);
  } catch {}
  return auth.currentUser;
}

export async function signInWithEmailAndPassword(
  _auth: typeof auth, email: string, password: string
) {
  const data = await firebasePost('signInWithPassword', {
    email, password, returnSecureToken: true,
  });

  const verified = await isEmailVerified(data.idToken);
  if (!verified) {
    // Guardar idToken temporalmente para poder reenviar verificación
    auth.currentUser = { email: data.email, uid: data.localId, idToken: data.idToken };
    throw { code: 'auth/email-not-verified', message: 'Correo no verificado' };
  }

  await saveUser({ email: data.email, uid: data.localId, idToken: data.idToken });
  return { user: auth.currentUser! };
}

export async function createUserWithEmailAndPassword(
  _auth: typeof auth, email: string, password: string
) {
  const data = await firebasePost('signUp', {
    email, password, returnSecureToken: true,
  });

  try {
    await sendEmailVerification(data.idToken);
  } catch (e: any) {
    console.warn('Error al enviar correo de verificación:', e);
    throw { code: 'auth/verification-email-failed', message: e?.message ?? 'No se pudo enviar el correo de verificación' };
  }

  // No iniciar sesión hasta que verifique el correo
  auth.currentUser = null;
  return { user: { email: data.email, uid: data.localId } };
}

export async function signInWithGoogleToken(
  token: string,
  tokenType: 'id_token' | 'access_token' = 'id_token'
) {
  const data = await firebasePost('signInWithIdp', {
    postBody: `${tokenType}=${encodeURIComponent(token)}&providerId=google.com`,
    requestUri: 'http://localhost',
    returnIdpCredential: true,
    returnSecureToken: true,
  });
  // Google ya verifica los correos, no necesita paso extra
  await saveUser({ email: data.email, uid: data.localId, idToken: data.idToken });
  return { user: auth.currentUser! };
}

export async function sendPasswordResetEmail(
  _auth: typeof auth, email: string
) {
  await firebasePost('sendOobCode', {
    requestType: 'PASSWORD_RESET', email,
  });
}

export async function signOut(_auth: typeof auth) {
  auth.currentUser = null;
  try { await AsyncStorage.removeItem(AUTH_KEY); } catch {}
}

export function onAuthStateChanged(
  _auth: typeof auth,
  callback: (user: typeof auth.currentUser) => void
): () => void {
  callback(auth.currentUser);
  return () => {};
}
