import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { ExpertsNavigator } from './ExpertsNavigator';
import HomeScreen from '@screens/home/HomeScreen';
// Placeholders — replaced as verticals are built:
// import MilkNavigator from './MilkNavigator';
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
          return <Text style={{ fontSize: 19 }}>{tab?.icon}</Text>;
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Milk"    component={PlaceholderScreen} options={{ title: 'Milk' }} />
      <Tab.Screen name="Experts" component={ExpertsNavigator} options={{ title: 'Experts' }} />
      <Tab.Screen name="Connect" component={PlaceholderScreen} options={{ title: 'Connect' }} />
      <Tab.Screen name="Gear"    component={PlaceholderScreen} options={{ title: 'Gear' }} />
      <Tab.Screen name="Me"      component={PlaceholderScreen} options={{ title: 'Me' }} />
    </Tab.Navigator>
  );
}

function PlaceholderScreen() {
  return <View style={{ flex: 1, backgroundColor: '#F5F0E8' }} />;
}
