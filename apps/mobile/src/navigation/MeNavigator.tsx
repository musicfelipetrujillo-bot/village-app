// Me tab stack. Hosts the profile hub and per-account edit screens so
// cross-tab deep links can coexist with settings flows inside the tab.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MeScreen from '@screens/me/MeScreen';
import EditProfileScreen from '@screens/me/EditProfileScreen';
import RadiusPreferenceScreen from '@screens/me/RadiusPreferenceScreen';
import NotificationPreferencesScreen from '@screens/me/NotificationPreferencesScreen';
import ChangePasswordScreen from '@screens/me/ChangePasswordScreen';
import ChangeEmailScreen from '@screens/me/ChangeEmailScreen';
import DeleteAccountScreen from '@screens/me/DeleteAccountScreen';
import SavedDashboardScreen from '@screens/me/SavedDashboardScreen';
import AnonymousModeScreen from '@screens/me/AnonymousModeScreen';

export type MeStackParamList = {
  MeRoot: undefined;
  EditProfile: undefined;
  RadiusPreference: undefined;
  NotificationPreferences: undefined;
  ChangePassword: undefined;
  ChangeEmail: undefined;
  DeleteAccount: undefined;
  SavedDashboard: undefined;
  AnonymousMode: undefined;
};

const Stack = createNativeStackNavigator<MeStackParamList>();

export function MeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MeRoot" component={MeScreen} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="RadiusPreference"
        component={RadiusPreferenceScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ChangeEmail"
        component={ChangeEmailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SavedDashboard"
        component={SavedDashboardScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AnonymousMode"
        component={AnonymousModeScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

export default MeNavigator;
