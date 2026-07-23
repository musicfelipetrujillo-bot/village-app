// V4 Phase G1+G2+G3 — HomeNavigator (Home + Milestones + Events + Perks)
// G7 extensions: DailyCheckin + CheckinResponse + DiscoverHome
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// v3 brand kit preview (2026-05-24) — was '@screens/home/HomeScreen' (v9).
// Revert by uncommenting the v9 line + commenting the v3 line.
// import HomeScreen from '@screens/home/HomeScreen';
import HomeScreen from '@screens/home/HomeScreenV3';
import BabyProfileSetupScreen from '@screens/home/BabyProfileSetupScreen';
import MilestoneDetailScreen from '@screens/home/MilestoneDetailScreen';
import MilestoneTimelineScreen from '@screens/home/MilestoneTimelineScreen';
import DailyCheckinScreen from '@screens/home/DailyCheckinScreen';
import CheckinResponseScreen from '@screens/home/CheckinResponseScreen';
import DiscoverHomeScreen from '@screens/home/DiscoverHomeScreen';
import InsightsScreen from '@screens/home/InsightsScreen';
import MomHubScreen from '@screens/home/MomHubScreen';
import NotificationsScreen from '@screens/home/NotificationsScreen';
import WeeklyJourneyScreen from '@screens/home/WeeklyJourneyScreen';
import EventsListScreen from '@screens/events/EventsListScreen';
import EventDetailScreen from '@screens/events/EventDetailScreen';
import RsvpConfirmScreen from '@screens/events/RsvpConfirmScreen';
import MyRsvpsScreen from '@screens/events/MyRsvpsScreen';
import SavedEventsScreen from '@screens/events/SavedEventsScreen';
import PerksListScreen from '@screens/perks/PerksListScreen';
import PerkDetailScreen from '@screens/perks/PerkDetailScreen';
import PerkClaimScreen from '@screens/perks/PerkClaimScreen';
import MyClaimsScreen from '@screens/perks/MyClaimsScreen';
// Villie Boxes (2026-06-18) — curated-commerce stack, lives on Home for launch.
import BoxesHubScreen from '@screens/boxes/BoxesHubScreen';
import BoxDetailScreen from '@screens/boxes/BoxDetailScreen';
import BoxesCartScreen from '@screens/boxes/BoxesCartScreen';
import BoxesCheckoutScreen from '@screens/boxes/BoxesCheckoutScreen';
import BoxOrderConfirmScreen from '@screens/boxes/BoxOrderConfirmScreen';
import BoxOrdersScreen from '@screens/boxes/BoxOrdersScreen';
// Day Sheet (2026-07-11) — caregiver handoff (schedule + tips + QR/PDF).
import DaySheetListScreen from '@screens/daySheet/DaySheetListScreen';
import DayPlanScreen from '@screens/dayPlan/DayPlanScreen';
import DaySheetBuilderScreen from '@screens/daySheet/DaySheetBuilderScreen';
import DaySheetShareScreen from '@screens/daySheet/DaySheetShareScreen';
import type { BoxId } from '@api/boxes';

export type HomeStackParamList = {
  HomeRoot: undefined;
  BabyProfileSetup: undefined;
  MilestoneDetail: { week: number };
  MilestoneTimeline: { week?: number };
  DailyCheckin: undefined;
  CheckinResponse: { checkinId: string };
  DiscoverHome: undefined;
  Insights: undefined;
  Notifications: undefined;
  WeeklyJourney: { week?: number } | undefined;
  EventsList: undefined;
  EventDetail: { id: string };
  RsvpConfirm: { eventId: string };
  MyRsvps: undefined;
  SavedEvents: undefined;
  PerksList: undefined;
  PerkDetail: { id: string };
  PerkClaim: { id: string };
  MyClaims: undefined;
  MomHub: undefined;
  BoxesHub: undefined;
  BoxDetail: { boxId: BoxId };
  BoxesCart: undefined;
  BoxesCheckout: undefined;
  BoxOrderConfirm: { orderId: string; amountCents: number };
  BoxOrders: undefined;
  DaySheetList: undefined;
  DaySheetBuilder: { id?: string } | undefined;
  DaySheetShare: { id: string };
  DayPlan: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeRoot" component={HomeScreen} />
      <Stack.Screen name="DayPlan" component={DayPlanScreen} />
      <Stack.Screen name="DaySheetList" component={DaySheetListScreen} />
      <Stack.Screen name="DaySheetBuilder" component={DaySheetBuilderScreen} />
      <Stack.Screen name="DaySheetShare" component={DaySheetShareScreen} />
      <Stack.Screen name="BabyProfileSetup" component={BabyProfileSetupScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MilestoneDetail" component={MilestoneDetailScreen} />
      <Stack.Screen name="MilestoneTimeline" component={MilestoneTimelineScreen} />
      <Stack.Screen name="DailyCheckin" component={DailyCheckinScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CheckinResponse" component={CheckinResponseScreen} />
      <Stack.Screen name="DiscoverHome" component={DiscoverHomeScreen} />
      <Stack.Screen name="Insights" component={InsightsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="WeeklyJourney" component={WeeklyJourneyScreen} />
      <Stack.Screen name="EventsList" component={EventsListScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="RsvpConfirm" component={RsvpConfirmScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MyRsvps" component={MyRsvpsScreen} />
      <Stack.Screen name="SavedEvents" component={SavedEventsScreen} />
      <Stack.Screen name="PerksList" component={PerksListScreen} />
      <Stack.Screen name="PerkDetail" component={PerkDetailScreen} />
      <Stack.Screen name="PerkClaim" component={PerkClaimScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MyClaims" component={MyClaimsScreen} />
      <Stack.Screen name="MomHub" component={MomHubScreen} />
      <Stack.Screen name="BoxesHub" component={BoxesHubScreen} />
      <Stack.Screen name="BoxDetail" component={BoxDetailScreen} />
      <Stack.Screen name="BoxesCart" component={BoxesCartScreen} />
      <Stack.Screen name="BoxesCheckout" component={BoxesCheckoutScreen} />
      <Stack.Screen name="BoxOrderConfirm" component={BoxOrderConfirmScreen} />
      <Stack.Screen name="BoxOrders" component={BoxOrdersScreen} />
    </Stack.Navigator>
  );
}
