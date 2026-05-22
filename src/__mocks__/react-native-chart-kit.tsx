import React from 'react';
import { Text } from 'react-native';

export const LineChart = (props: any) => (
  <Text testID="mock-chart">
    Mock LineChart con {props.data?.datasets?.length || 0} datasets
  </Text>
);

export const BarChart = () => <Text>Mock BarChart</Text>;
export const PieChart = () => <Text>Mock PieChart</Text>;
export const ProgressChart = () => <Text>Mock ProgressChart</Text>;
export const ContributionGraph = () => <Text>Mock ContributionGraph</Text>;
export const StackedBarChart = () => <Text>Mock StackedBarChart</Text>;
