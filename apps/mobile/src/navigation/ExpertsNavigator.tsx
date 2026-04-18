import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExpertsHomeScreen from '@screens/experts/ExpertsHomeScreen';
import SpecialistProfileScreen from '@screens/experts/SpecialistProfileScreen';
import ReviewSubmitScreen from '@screens/experts/ReviewSubmitScreen';

export type ExpertsStackParamList = {
  ExpertsHome: undefined;
  SpecialistProfile: { specialistId: string };
  ReviewSubmit: { specialistId: string };
};

const Stack = createNativeStackNavigator<ExpertsStackParamList>();

export function ExpertsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExpertsHome" component={ExpertsHomeScreen} />
      <Stack.Screen
        name="SpecialistProfile"
        component={SpecialistProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ReviewSubmit"
        component={ReviewSubmitScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
