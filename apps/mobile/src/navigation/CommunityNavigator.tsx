import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommunityHomeScreen from '@screens/community/CommunityHomeScreen';
import RoomChatScreen from '@screens/community/RoomChatScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
  RoomChat: { roomId: string; roomSlug: string };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export function CommunityNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityHome" component={CommunityHomeScreen} />
      <Stack.Screen name="RoomChat" component={RoomChatScreen} />
    </Stack.Navigator>
  );
}
