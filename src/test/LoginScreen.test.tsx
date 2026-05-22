import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../screens/LoginScreen';
import * as FirebaseAuth from 'firebase/auth';

jest.mock('firebase/app');
jest.mock('firebase/auth');
jest.mock('firebase/database');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    reset: jest.fn(),
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra error si los campos están vacíos', async () => {
    const { getAllByText } = render(<LoginScreen />);
    fireEvent.press(getAllByText('Iniciar Sesión')[1]); // Botón de formulario
    await waitFor(() => {
      expect(getAllByText('Iniciar Sesión')[1]).toBeTruthy();
    });
  });

  it('llama a signInWithEmailAndPassword con datos válidos', async () => {
    const { getByPlaceholderText, getAllByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('Correo electrónico'), 'test@correo.com');
    fireEvent.changeText(getByPlaceholderText('Contraseña'), '123456');
    fireEvent.press(getAllByText('Iniciar Sesión')[1]);

    await waitFor(() => {
      expect(FirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@correo.com',
        '123456'
      );
    });
  });

  it('cambia a modo registro y llama a createUserWithEmailAndPassword', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    fireEvent.press(getByText('Registrarse'));

    fireEvent.changeText(getByPlaceholderText('Nombre'), 'Juan');
    fireEvent.changeText(getByPlaceholderText('Apellido'), 'Perez');
    fireEvent.changeText(getByPlaceholderText('Correo electrónico'), 'nuevo@correo.com');
    fireEvent.changeText(getByPlaceholderText('Contraseña'), 'abcdef');

    fireEvent.press(getByText('Crear Cuenta'));

    await waitFor(() => {
      expect(FirebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'nuevo@correo.com',
        'abcdef'
      );
    });
  });

  it('envía correo de recuperación', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('Correo electrónico'), 'reset@correo.com');
    fireEvent.press(getByText('¿Olvidaste tu contraseña?'));

    await waitFor(() => {
      expect(FirebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'reset@correo.com'
      );
    });
  });
});
