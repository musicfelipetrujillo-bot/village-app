// Manual tab — editorial product hook. Owns ManualHome (audience/category
// surface) + ManualCategory (filtered article list) + WeeklyJourney (this
// week's deep-dive, also reachable from Home).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ManualHomeScreen from '@screens/manual/ManualHomeScreen';
import ManualCategoryScreen from '@screens/manual/ManualCategoryScreen';
import WeeklyJourneyScreen from '@screens/home/WeeklyJourneyScreen';
import MilestoneDetailScreen from '@screens/home/MilestoneDetailScreen';
import MilestoneTimelineScreen from '@screens/home/MilestoneTimelineScreen';

const Stack = createNativeStackNavigator();

export function ManualNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ManualHome" component={ManualHomeScreen} />
      <Stack.Screen name="ManualCategory" component={ManualCategoryScreen} />
      <Stack.Screen name="WeeklyJourney" component={WeeklyJourneyScreen} />
      <Stack.Screen name="MilestoneDetail" component={MilestoneDetailScreen} />
      <Stack.Screen name="MilestoneTimeline" component={MilestoneTimelineScreen} />
    </Stack.Navigator>
  );
}

export default ManualNavigator;
