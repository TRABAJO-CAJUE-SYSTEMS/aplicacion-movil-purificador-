export const getAuth = jest.fn(() => ({
  currentUser: null,
}));

export const signInWithEmailAndPassword = jest.fn();
export const createUserWithEmailAndPassword = jest.fn();
export const sendPasswordResetEmail = jest.fn();
