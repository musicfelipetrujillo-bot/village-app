// Inbox tab — unified messages surface. Owns the list view; thread detail
// screens stay registered under their per-vertical navigators (MilkNavigator,
// GearNavigator) and are reached via tab-jump from InboxHome.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InboxHomeScreen from '@screens/inbox/InboxHomeScreen';

const Stack = createNativeStackNavigator();

export function InboxNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InboxHome" component={InboxHomeScreen} />
    </Stack.Navigator>
  );
}

export default InboxNavigator;
