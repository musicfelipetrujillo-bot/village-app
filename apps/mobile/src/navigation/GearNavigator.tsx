// V4 Phase G4 — Gear stack navigator.
// G6 extension: GearMessageThreads + GearMessageDetail routes.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import GearBrowseScreen from '@screens/gear/GearBrowseScreen';
import GearListingDetailScreen from '@screens/gear/GearListingDetailScreen';
import CreateListingScreen from '@screens/gear/CreateListingScreen';
import MyListingsScreen from '@screens/gear/MyListingsScreen';
import SavedGearScreen from '@screens/gear/SavedGearScreen';
import GearMessageThreadsScreen from '@screens/gear/GearMessageThreadsScreen';
import GearMessageDetailScreen from '@screens/gear/GearMessageDetailScreen';
import BoostListingScreen from '@screens/gear/BoostListingScreen';

export type GearStackParamList = {
  GearBrowse: undefined;
  GearListingDetail: { id: string };
  CreateListing: undefined;
  MyListings: undefined;
  SavedGear: undefined;
  GearMessageThreads: undefined;
  GearMessageDetail: {
    threadId: string;
    listingId: string;
    listingTitle: string;
    otherDisplayName: string;
    isSellerSide: boolean;
  };
  BoostListing: { listingId: string; listingTitle?: string; boostedUntil?: string | null };
};

const Stack = createNativeStackNavigator<GearStackParamList>();

export default function GearNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GearBrowse" component={GearBrowseScreen} />
      <Stack.Screen name="GearListingDetail" component={GearListingDetailScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MyListings" component={MyListingsScreen} />
      <Stack.Screen name="SavedGear" component={SavedGearScreen} />
      <Stack.Screen name="GearMessageThreads" component={GearMessageThreadsScreen} />
      <Stack.Screen name="GearMessageDetail" component={GearMessageDetailScreen} />
      <Stack.Screen name="BoostListing" component={BoostListingScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
