import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';

import { useSensorData } from './src/hooks/useSensorData';
import { useAlerts } from './src/hooks/useAlerts';
import DashboardScreen from './src/screens/DashboardScreen';
import MapScreen from './src/screens/MapScreen';
import AlertOverlay from './src/components/AlertOverlay';

const Tab = createBottomTabNavigator();

export default function App() {
  const { data, history, connected } = useSensorData();
  const { alerts, dismissAlert } = useAlerts(data, connected);

  return (
    <SafeAreaProvider>
      <AlertOverlay alerts={alerts} onDismiss={dismissAlert} />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#0a1410',
              borderTopColor: 'rgba(80,180,100,0.2)',
              borderTopWidth: 1,
              paddingBottom: 6,
              paddingTop: 4,
              height: 60,
            },
            tabBarActiveTintColor: '#3ddc84',
            tabBarInactiveTintColor: '#4a6a55',
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          }}
        >
          <Tab.Screen
            name="Dashboard"
            options={{
              tabBarLabel: 'Показания',
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
            }}
          >
            {() => <DashboardScreen data={data} history={history} connected={connected} />}
          </Tab.Screen>

          <Tab.Screen
            name="Map"
            options={{
              tabBarLabel: 'Карта',
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text>,
            }}
          >
            {() => <MapScreen data={data} connected={connected} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
