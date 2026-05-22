import React from 'react';
import { render } from '@testing-library/react-native';
import TrendChart from '../components/TrendChart';

// Se renderiza correctamente con datos, muestra un gráfico (mockeado), se comporta bien incluso si no tiene datos.

describe('TrendChart', () => {
  it('renderiza correctamente con datos', () => {
    const data = {
      labels: ['1', '2', '3'],
      alcohol: [10, 20, 30],
      benceno: [5, 10, 15],
      co: [12, 14, 16],
      humo: [4, 6, 8],
      h2: [3, 4, 5],
      nh3: [1, 2, 3],
      co2: [350, 400, 450],
    };

    const { getByText, getByTestId, toJSON } = render(<TrendChart trendData={data} />);
    expect(getByText('Tendencia de Sensores')).toBeTruthy();
    expect(getByTestId('mock-chart')).toBeTruthy(); // Usamos el testID del mock
    expect(toJSON()).toMatchSnapshot(); //para guardar y comparar la estructura del componente.
  });

  it('muestra el gráfico aunque los datos estén vacíos', () => {
    const emptyData = {
      labels: [],
      alcohol: [],
      benceno: [],
      co: [],
      co2: [],
      h2: [],
      humo: [],
      nh3: [],
    };

    const { getByTestId } = render(<TrendChart trendData={emptyData} />);
    expect(getByTestId('mock-chart')).toBeTruthy(); // sigue siendo el mock osea para verificar que el componente del gráfico está ahí.
  });
});
