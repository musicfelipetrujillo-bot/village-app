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
import MilkMyListingsScreen from '@screens/milk/MilkMyListingsScreen';
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

// V6 — Milk Vault (personal stash + optional marketplace planning)
import MilkVaultModePickerScreen from '@screens/milkVault/MilkVaultModePickerScreen';
import MilkVaultDashboardScreen from '@screens/milkVault/MilkVaultDashboardScreen';
import MilkVaultAddBagScreen from '@screens/milkVault/MilkVaultAddBagScreen';
import MilkVaultScanScreen from '@screens/milkVault/MilkVaultScanScreen';
import MilkVaultBagsScreen from '@screens/milkVault/MilkVaultBagsScreen';
import MilkVaultKeepSellScreen from '@screens/milkVault/MilkVaultKeepSellScreen';
import MilkVaultListingScreen from '@screens/milkVault/MilkVaultListingScreen';
import MilkVaultSettingsScreen from '@screens/milkVault/MilkVaultSettingsScreen';

/** Prefill payload passed from the AI scanner into the Add Bag confirmation. */
export interface MilkVaultBagPrefill {
  ounces?: number | null;
  pumped_date?: string | null;
  frozen_date?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  raw?: Record<string, unknown> | null;
}

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

  // V6 — Milk Vault
  MilkVaultModePicker: { switching?: boolean } | undefined;
  MilkVaultDashboard: undefined;
  MilkVaultAddBag: { prefill?: MilkVaultBagPrefill } | undefined;
  MilkVaultScan: undefined;
  MilkVaultBags: undefined;
  MilkVaultKeepSell: undefined;
  MilkVaultListing: { prefillOunces?: number } | undefined;
  MilkVaultSettings: undefined;
};

const Stack = createNativeStackNavigator<MilkStackParamList>();

export function MilkNavigator() {
  return (
    <Stack.Navigator initialRouteName="MilkVaultDashboard" screenOptions={{ headerShown: false }}>
      {/* Milk tab lands on the personal stash dashboard; the donor marketplace
          (MilkHome) is one toggle away. Both fade so the my-stash|marketplace
          toggle swaps in place instead of sliding like a push. */}
      <Stack.Screen name="MilkHome" component={MilkConnectHomeScreen} options={{ animation: 'fade' }} />
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
      {/* V6 — Milk Vault */}
      <Stack.Screen name="MilkVaultModePicker" component={MilkVaultModePickerScreen} />
      <Stack.Screen name="MilkVaultDashboard" component={MilkVaultDashboardScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="MilkVaultAddBag" component={MilkVaultAddBagScreen} />
      <Stack.Screen name="MilkVaultScan" component={MilkVaultScanScreen} />
      <Stack.Screen name="MilkVaultBags" component={MilkVaultBagsScreen} />
      <Stack.Screen name="MilkVaultKeepSell" component={MilkVaultKeepSellScreen} />
      <Stack.Screen name="MilkVaultListing" component={MilkVaultListingScreen} />
      <Stack.Screen name="MilkVaultSettings" component={MilkVaultSettingsScreen} />
      {/* M5+ placeholder */}
      <Stack.Screen name="DonorDashboard" component={PlaceholderScreen} />
      <Stack.Screen name="DonorListingManager" component={MilkMyListingsScreen} />
    </Stack.Navigator>
  );
}
