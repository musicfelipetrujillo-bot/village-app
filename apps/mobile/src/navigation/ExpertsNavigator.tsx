import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExpertsHomeScreen from '@screens/experts/ExpertsHomeScreen';
import SpecialistProfileScreen from '@screens/experts/SpecialistProfileScreen';
import ReviewSubmitScreen from '@screens/experts/ReviewSubmitScreen';
import FavoritesScreen from '@screens/experts/FavoritesScreen';
import BookingScreen from '@screens/experts/BookingScreen';
import PaymentScreen from '@screens/experts/PaymentScreen';
import BookingConfirmScreen from '@screens/experts/BookingConfirmScreen';
import MessagingScreen from '@screens/experts/MessagingScreen';
import SpecialistsMapScreen from '@screens/experts/SpecialistsMapScreen';
import type { SpecialtyType } from 'shared/src/types/v1';

export type ExpertsStackParamList = {
  // `specialty` is an optional deeplink hint (used by WeeklyJourneyScreen's
  // village_supports CTAs — e.g. `experts:ExpertsHome:lactation_consultant`).
  // When set, the screen pre-selects the matching filter chip on mount.
  ExpertsHome: { specialty?: SpecialtyType } | undefined;
  SpecialistProfile: { specialistId: string };
  ReviewSubmit: { specialistId: string };
  Favorites: undefined;
  Booking: { specialistId: string };
  Payment: {
    specialistId: string;
    specialistName: string;
    serviceName: string;
    amountCents: number;
    appointmentAt: string;
    isTelehealth: boolean;
    telehealth_link?: string;
  };
  BookingConfirm: {
    specialistId: string;
    specialistName: string;
    serviceName: string;
    appointmentAt: string;
    isTelehealth: boolean;
    telehealth_link?: string;
    amountCents: number;
  };
  Messaging: { specialistId: string };
  SpecialistsMap: undefined;
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
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="BookingConfirm"
        component={BookingConfirmScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen
        name="Messaging"
        component={MessagingScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SpecialistsMap"
        component={SpecialistsMapScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
