import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { AuthStack } from './AuthStack';
import { AppNavigator } from './AppNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
