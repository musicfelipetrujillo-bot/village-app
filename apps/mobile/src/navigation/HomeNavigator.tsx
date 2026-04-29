// V4 Phase G1+G2+G3 — HomeNavigator (Home + Milestones + Events + Perks)
// G7 extensions: DailyCheckin + CheckinResponse + DiscoverHome
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '@screens/home/HomeScreen';
import BabyProfileSetupScreen from '@screens/home/BabyProfileSetupScreen';
import MilestoneDetailScreen from '@screens/home/MilestoneDetailScreen';
import MilestoneTimelineScreen from '@screens/home/MilestoneTimelineScreen';
import DailyCheckinScreen from '@screens/home/DailyCheckinScreen';
import CheckinResponseScreen from '@screens/home/CheckinResponseScreen';
import DiscoverHomeScreen from '@screens/home/DiscoverHomeScreen';
import NotificationsScreen from '@screens/home/NotificationsScreen';
import WeeklyJourneyScreen from '@screens/home/WeeklyJourneyScreen';
import EventsListScreen from '@screens/events/EventsListScreen';
import EventDetailScreen from '@screens/events/EventDetailScreen';
import RsvpConfirmScreen from '@screens/events/RsvpConfirmScreen';
import MyRsvpsScreen from '@screens/events/MyRsvpsScreen';
import PerksListScreen from '@screens/perks/PerksListScreen';
import PerkDetailScreen from '@screens/perks/PerkDetailScreen';
import PerkClaimScreen from '@screens/perks/PerkClaimScreen';
import MyClaimsScreen from '@screens/perks/MyClaimsScreen';

export type HomeStackParamList = {
  HomeRoot: undefined;
  BabyProfileSetup: undefined;
  MilestoneDetail: { week: number };
  MilestoneTimeline: { week?: number };
  DailyCheckin: undefined;
  CheckinResponse: { checkinId: string };
  DiscoverHome: undefined;
  Notifications: undefined;
  WeeklyJourney: { week?: number } | undefined;
  EventsList: undefined;
  EventDetail: { id: string };
  RsvpConfirm: { eventId: string };
  MyRsvps: undefined;
  PerksList: undefined;
  PerkDetail: { id: string };
  PerkClaim: { id: string };
  MyClaims: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeRoot" component={HomeScreen} />
      <Stack.Screen name="BabyProfileSetup" component={BabyProfileSetupScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MilestoneDetail" component={MilestoneDetailScreen} />
      <Stack.Screen name="MilestoneTimeline" component={MilestoneTimelineScreen} />
      <Stack.Screen name="DailyCheckin" component={DailyCheckinScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CheckinResponse" component={CheckinResponseScreen} />
      <Stack.Screen name="DiscoverHome" component={DiscoverHomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="WeeklyJourney" component={WeeklyJourneyScreen} />
      <Stack.Screen name="EventsList" component={EventsListScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="RsvpConfirm" component={RsvpConfirmScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MyRsvps" component={MyRsvpsScreen} />
      <Stack.Screen name="PerksList" component={PerksListScreen} />
      <Stack.Screen name="PerkDetail" component={PerkDetailScreen} />
      <Stack.Screen name="PerkClaim" component={PerkClaimScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="MyClaims" component={MyClaimsScreen} />
    </Stack.Navigator>
  );
}
