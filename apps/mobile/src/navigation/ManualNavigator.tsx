// Manual tab — short-video library. Owns ManualHome (this-week + audience/
// category browse) + ManualCategory (2-col video grid for one bucket) +
// ManualVideo (Mux player). WeeklyJourney + Milestone screens stay registered
// here because they're reachable from inline links in long-form video copy
// and from cross-tab deep-links.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// v3 brand kit preview (2026-05-24) — was '@screens/manual/ManualHomeScreen' (v9).
// Revert by uncommenting the v9 line + commenting the v3 line.
// import ManualHomeScreen from '@screens/manual/ManualHomeScreen';
import ManualHomeScreen from '@screens/manual/ManualScrollV3';
import ManualCategoryScreen from '@screens/manual/ManualCategoryScreen';
import ManualVideoScreen from '@screens/manual/ManualVideoScreen';
import SavedManualScreen from '@screens/manual/SavedManualScreen';
import WeeklyJourneyScreen from '@screens/home/WeeklyJourneyScreen';
import MilestoneDetailScreen from '@screens/home/MilestoneDetailScreen';
import MilestoneTimelineScreen from '@screens/home/MilestoneTimelineScreen';

const Stack = createNativeStackNavigator();

export function ManualNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ManualHome" component={ManualHomeScreen} />
      <Stack.Screen name="ManualCategory" component={ManualCategoryScreen} />
      <Stack.Screen name="ManualVideo" component={ManualVideoScreen} />
      <Stack.Screen name="SavedManual" component={SavedManualScreen} />
      <Stack.Screen name="WeeklyJourney" component={WeeklyJourneyScreen} />
      <Stack.Screen name="MilestoneDetail" component={MilestoneDetailScreen} />
      <Stack.Screen name="MilestoneTimeline" component={MilestoneTimelineScreen} />
    </Stack.Navigator>
  );
}

export default ManualNavigator;
