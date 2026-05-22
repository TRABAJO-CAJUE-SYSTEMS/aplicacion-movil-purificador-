// src/test/InicioScreen.test.tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import InicioScreen from '../screens/InicioScreen';

// Mocks globales  para que la navegación no cause errores.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('firebase/app');
// simulamos una respuesta con datos reales (CO2, Alcohol, etc.).
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(),
  onValue: jest.fn((ref, callback) => {
    callback({
      val: () => ({
        CO2: 400,
        Alcohol: 30,
        Benceno: 12,
        Humo: 8,
        CO: 15,
        H2: 5,
        NH3: 2
      }),
    });
  }),
  off: jest.fn(),
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(),
}));

jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null,
  BarChart: () => null,
  PieChart: () => null,
  ProgressChart: () => null,
  ContributionGraph: () => null,
  StackedBarChart: () => null,
}));

//comprueba que renderize el componete con render
describe('InicioScreen', () => {
  it('renderiza tarjetas de sensores con datos', async () => {
    const { getByText } = render(<InicioScreen />);
    await waitFor(() => { //para esperar a que los datos aparezcan
      expect(getByText('Calidad de Aire (CO2)')).toBeTruthy();
      expect(getByText('Alcohol')).toBeTruthy();
      expect(getByText('Benceno')).toBeTruthy();
      expect(getByText('Humo')).toBeTruthy();
      expect(getByText('CO (Monóxido)')).toBeTruthy();
      expect(getByText('H2 (Hidrógeno)')).toBeTruthy();
      expect(getByText('NH3 (Amoniaco)')).toBeTruthy();
    });
  });
});
