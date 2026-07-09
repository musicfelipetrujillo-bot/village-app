// MilkNavigator — V2 Milk Hub routes.
//
// ⚠️ The Milk Hub is CASH-ONLY / connector-only (see
// memory/project_milk_cash_only.md). The Village connects donors and moms and is
// NOT a party to the transaction. As of migration 098 the entire Stripe Connect /
// paid-purchase / order-history / dispute / Shippo-shipping / transaction-review
// subsystem has been RETIRED — the following screens and their routes were removed:
//   StripeOnboarding, MilkMatch, MilkPurchase, MilkOrderConfirm, MilkOrders,
//   MilkReviewSubmit, MilkDisputeOpen, MilkShippingLabel.
//
// Active routes in the cash-only world: MilkHome, BecomeDonorIntro,
// DonorQuestionnaire, TrustBadgeBuilder, CreateListing, DonorSocialLinks,
// OnboardingComplete, DonorSearchList, DonorMap, DonorProfile, SavedDonors,
// MilkMessageThreads, MilkMessageDetail.
import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// M1 screens
import MilkConnectHomeScreen from '@screens/milk/MilkConnectHomeScreen';
import BecomeDonorIntroScreen from '@screens/milk/BecomeDonorIntroScreen';
import DonorQuestionnaireScreen from '@screens/milk/DonorQuestionnaireScreen';
import TrustBadgeBuilderScreen from '@screens/milk/TrustBadgeBuilderScreen';
import CreateListingScreen from '@screens/milk/CreateListingScreen';
import DonorSocialLinksScreen from '@screens/milk/DonorSocialLinksScreen';
import OnboardingCompleteScreen from '@screens/milk/OnboardingCompleteScreen';

// M2 screens
import DonorSearchListScreen from '@screens/milk/DonorSearchListScreen';
import DonorMapScreen from '@screens/milk/DonorMapScreen';
import DonorProfileScreen from '@screens/milk/DonorProfileScreen';
import SavedDonorsScreen from '@screens/milk/SavedDonorsScreen';

// M4 screens
import MilkMessageThreadsScreen from '@screens/milk/MilkMessageThreadsScreen';
import MilkMessageDetailScreen from '@screens/milk/MilkMessageDetailScreen';

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
  OnboardingComplete: undefined;
  // M2 — Discovery
  DonorSearchList: undefined;
  DonorMap: undefined;
  DonorProfile: { donorProfileId: string };
  SavedDonors: undefined;
  // M2 — Donor dashboard
  DonorDashboard: undefined;
  DonorListingManager: undefined;
  DonorSocialLinks: { donorProfileId: string };
  // M4 — Messaging
  MilkMessageThreads: undefined;
  MilkMessageDetail: { threadId: string; donorProfileId: string; otherDisplayName?: string };
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
      <Stack.Screen name="DonorSocialLinks" component={DonorSocialLinksScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
      {/* M2 */}
      <Stack.Screen name="DonorSearchList" component={DonorSearchListScreen} />
      <Stack.Screen name="DonorMap" component={DonorMapScreen} />
      <Stack.Screen name="DonorProfile" component={DonorProfileScreen} />
      <Stack.Screen name="SavedDonors" component={SavedDonorsScreen} />
      {/* M4 */}
      <Stack.Screen name="MilkMessageThreads" component={MilkMessageThreadsScreen} />
      <Stack.Screen name="MilkMessageDetail" component={MilkMessageDetailScreen} />
      {/* M5+ placeholder */}
      <Stack.Screen name="DonorDashboard" component={PlaceholderScreen} />
      <Stack.Screen name="DonorListingManager" component={PlaceholderScreen} />
    </Stack.Navigator>
  );
}
