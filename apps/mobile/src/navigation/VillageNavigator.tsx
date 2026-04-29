// Village tab — editorial entry point that fans out into Specialists, Milk,
// Events, Perks, Gear. Vertical destinations live in their own per-tab
// navigators (registered but hidden from the bar in AppNavigator); Village
// only owns its own root screen and the Events/Perks routes that previously
// lived under HomeNavigator.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import VillageHomeScreen from '@screens/village/VillageHomeScreen';
import EventsListScreen from '@screens/events/EventsListScreen';
import EventDetailScreen from '@screens/events/EventDetailScreen';
import RsvpConfirmScreen from '@screens/events/RsvpConfirmScreen';
import MyRsvpsScreen from '@screens/events/MyRsvpsScreen';
import PerksListScreen from '@screens/perks/PerksListScreen';
import PerkDetailScreen from '@screens/perks/PerkDetailScreen';
import PerkClaimScreen from '@screens/perks/PerkClaimScreen';
import MyClaimsScreen from '@screens/perks/MyClaimsScreen';

const Stack = createNativeStackNavigator();

export function VillageNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="VillageHome" component={VillageHomeScreen} />
      {/* Events */}
      <Stack.Screen name="EventsList" component={EventsListScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen
        name="RsvpConfirm"
        component={RsvpConfirmScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="MyRsvps" component={MyRsvpsScreen} />
      {/* Perks */}
      <Stack.Screen name="PerksList" component={PerksListScreen} />
      <Stack.Screen name="PerkDetail" component={PerkDetailScreen} />
      <Stack.Screen
        name="PerkClaim"
        component={PerkClaimScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="MyClaims" component={MyClaimsScreen} />
    </Stack.Navigator>
  );
}

export default VillageNavigator;
