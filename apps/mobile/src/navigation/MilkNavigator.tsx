import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// M1 screens
import MilkConnectHomeScreen from '@screens/milk/MilkConnectHomeScreen';
import BecomeDonorIntroScreen from '@screens/milk/BecomeDonorIntroScreen';
import DonorQuestionnaireScreen from '@screens/milk/DonorQuestionnaireScreen';
import TrustBadgeBuilderScreen from '@screens/milk/TrustBadgeBuilderScreen';
import CreateListingScreen from '@screens/milk/CreateListingScreen';
import StripeOnboardingScreen from '@screens/milk/StripeOnboardingScreen';
import OnboardingCompleteScreen from '@screens/milk/OnboardingCompleteScreen';

// M2 screens
import DonorSearchListScreen from '@screens/milk/DonorSearchListScreen';
import DonorMapScreen from '@screens/milk/DonorMapScreen';
import DonorProfileScreen from '@screens/milk/DonorProfileScreen';
import SavedDonorsScreen from '@screens/milk/SavedDonorsScreen';

// M3 screens
import MilkMatchScreen from '@screens/milk/MilkMatchScreen';
import MilkPurchaseScreen from '@screens/milk/MilkPurchaseScreen';
import MilkOrderConfirmScreen from '@screens/milk/MilkOrderConfirmScreen';

// M4 screens
import MilkMessageThreadsScreen from '@screens/milk/MilkMessageThreadsScreen';
import MilkMessageDetailScreen from '@screens/milk/MilkMessageDetailScreen';
import MilkOrdersScreen from '@screens/milk/MilkOrdersScreen';
import MilkReviewSubmitScreen from '@screens/milk/MilkReviewSubmitScreen';

// M5 screens
import MilkDisputeOpenScreen from '@screens/milk/MilkDisputeOpenScreen';
import MilkShippingLabelScreen from '@screens/milk/MilkShippingLabelScreen';

// Placeholders
function PlaceholderScreen() {
  return <View style={{ flex: 1, backgroundColor: '#F5F0E8' }} />;
}

export type MilkStackParamList = {
  MilkHome: undefined;
  // M1 — BecomeDonor flow
  BecomeDonorIntro: undefined;
  DonorQuestionnaire: undefined;
  TrustBadgeBuilder: { donorProfileId: string };
  CreateListing: { donorProfileId: string };
  StripeOnboarding: { donorProfileId: string };
  OnboardingComplete: undefined;
  // M2 — Discovery
  DonorSearchList: undefined;
  DonorMap: undefined;
  DonorProfile: { donorProfileId: string };
  SavedDonors: undefined;
  // M2 — Donor dashboard
  DonorDashboard: undefined;
  DonorListingManager: undefined;
  // M3 — AI Match + Purchase
  MilkMatch: undefined;
  MilkPurchase: { donorProfileId: string; listingId: string };
  MilkOrderConfirm: {
    transactionId: string;
    donorProfileId: string;
    donorDisplayName: string;
    oz: number;
    totalCents: number;
    fulfillmentMethod: 'pickup' | 'shipping';
  };
  // M4 — Messaging + Reviews + Orders
  MilkMessageThreads: undefined;
  MilkMessageDetail: { threadId: string; donorProfileId: string; otherDisplayName?: string };
  MilkOrders: undefined;
  MilkReviewSubmit: {
    transactionId: string;
    donorProfileId: string;
    donorDisplayName: string;
  };
  // M5 — Disputes + Shipping
  MilkDisputeOpen: {
    transactionId: string;
    role: 'recipient' | 'donor';
    donorDisplayName?: string;
  };
  MilkShippingLabel: { transactionId: string };
};

const Stack = createNativeStackNavigator<MilkStackParamList>();

export function MilkNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MilkHome" component={MilkConnectHomeScreen} />
      {/* M1 */}
      <Stack.Screen name="BecomeDonorIntro" component={BecomeDonorIntroScreen} />
      <Stack.Screen name="DonorQuestionnaire" component={DonorQuestionnaireScreen} />
      <Stack.Screen name="TrustBadgeBuilder" component={TrustBadgeBuilderScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="StripeOnboarding" component={StripeOnboardingScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
      {/* M2 */}
      <Stack.Screen name="DonorSearchList" component={DonorSearchListScreen} />
      <Stack.Screen name="DonorMap" component={DonorMapScreen} />
      <Stack.Screen name="DonorProfile" component={DonorProfileScreen} />
      <Stack.Screen name="SavedDonors" component={SavedDonorsScreen} />
      {/* M3 */}
      <Stack.Screen name="MilkMatch" component={MilkMatchScreen} />
      <Stack.Screen name="MilkPurchase" component={MilkPurchaseScreen} />
      <Stack.Screen name="MilkOrderConfirm" component={MilkOrderConfirmScreen} />
      {/* M4 */}
      <Stack.Screen name="MilkMessageThreads" component={MilkMessageThreadsScreen} />
      <Stack.Screen name="MilkMessageDetail" component={MilkMessageDetailScreen} />
      <Stack.Screen name="MilkOrders" component={MilkOrdersScreen} />
      <Stack.Screen name="MilkReviewSubmit" component={MilkReviewSubmitScreen} />
      {/* M5 */}
      <Stack.Screen name="MilkDisputeOpen" component={MilkDisputeOpenScreen} />
      <Stack.Screen name="MilkShippingLabel" component={MilkShippingLabelScreen} />
      {/* M5+ placeholder */}
      <Stack.Screen name="DonorDashboard" component={PlaceholderScreen} />
      <Stack.Screen name="DonorListingManager" component={PlaceholderScreen} />
    </Stack.Navigator>
  );
}
