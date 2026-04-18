import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Tab screens — stubs, filled in per vertical
// import HomeScreen from '@screens/home/HomeScreen';
// import MilkNavigator from './MilkNavigator';
// import ExpertsNavigator from './ExpertsNavigator';
// import ConnectNavigator from './ConnectNavigator';
// import GearNavigator from './GearNavigator';
// import MeScreen from '@screens/me/MeScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home',    icon: '🏠' },
  { name: 'Milk',    icon: '🤱' },
  { name: 'Experts', icon: '🩺' },
  { name: 'Connect', icon: '💬' },
  { name: 'Gear',    icon: '🛒' },
  { name: 'Me',      icon: '👤' },
];

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#B85C38',
        tabBarInactiveTintColor: '#9A8070',
        tabBarStyle: {
          backgroundColor: '#FDFAF5',
          borderTopColor: 'rgba(0,0,0,0.08)',
          height: 72,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
        tabBarIcon: ({ color }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return <Text style={{ fontSize: 22 }}>{tab?.icon}</Text>;
        },
      })}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={PlaceholderScreen}
          options={{ title: tab.name }}
        />
      ))}
    </Tab.Navigator>
  );
}

// Temporary placeholder — replaced as each vertical is built
function PlaceholderScreen() {
  return null;
}
