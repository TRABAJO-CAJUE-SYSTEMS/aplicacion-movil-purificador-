import { jest } from '@jest/globals';

export const getAuth = jest.fn(() => ({
  currentUser: null,
}));

export const signInWithEmailAndPassword    = jest.fn();
export const createUserWithEmailAndPassword = jest.fn();
export const sendPasswordResetEmail        = jest.fn();
export const signOut                       = jest.fn(() => Promise.resolve());
export const onAuthStateChanged            = jest.fn((auth: any, cb: any) => { cb(null); return () => {}; });
