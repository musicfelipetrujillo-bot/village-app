import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SupportedLanguage } from 'shared/src/types/v1';

import SplashScreen from '@screens/auth/SplashScreen';
import OnboardingScreen from '@screens/auth/OnboardingScreen';
import SignUpScreen from '@screens/auth/SignUpScreen';
import LoginScreen from '@screens/auth/LoginScreen';
import ForgotPasswordScreen from '@screens/auth/ForgotPasswordScreen';
import OnboardingProfileScreen from '@screens/auth/OnboardingProfileScreen';

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignUp: { language?: SupportedLanguage };
  Login: undefined;
  ForgotPassword: undefined;
  OnboardingProfile: { language?: SupportedLanguage };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="OnboardingProfile"
        component={OnboardingProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
