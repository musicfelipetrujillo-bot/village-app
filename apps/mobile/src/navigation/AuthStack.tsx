import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens imported when built
// import SplashScreen from '@screens/auth/SplashScreen';
// import OnboardingScreen from '@screens/auth/OnboardingScreen';
// import SignUpScreen from '@screens/auth/SignUpScreen';
// import LoginScreen from '@screens/auth/LoginScreen';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Auth screens added per V1 Phase 1 */}
    </Stack.Navigator>
  );
}
