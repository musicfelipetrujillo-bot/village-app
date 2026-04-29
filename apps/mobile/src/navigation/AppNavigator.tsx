// Tab IA (2026-04-28 redesign): 5 visible tabs — Home / Manual / Village /
// Inbox / Profile. Vertical navigators (Milk, Experts, Gear) are still
// registered so existing cross-tab deeplinks (`navigation.getParent().navigate('Milk', { screen: ... })`)
// continue to work, but hidden from the bar via `tabBarButton: () => null`.
// Village screen jumps INTO Milk/Experts/Gear; Inbox jumps into Milk and Gear
// thread detail screens.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '@utils/constants';
import { ExpertsNavigator } from './ExpertsNavigator';
import { MilkNavigator } from './MilkNavigator';
import { HomeNavigator } from './HomeNavigator';
import { ManualNavigator } from './ManualNavigator';
import { VillageNavigator } from './VillageNavigator';
import { InboxNavigator } from './InboxNavigator';
import GearNavigator from './GearNavigator';
import { MeNavigator } from './MeNavigator';

const Tab = createBottomTabNavigator();

// Feather stroke-style icons — matches the moodboard's clean editorial tab bar
// (uniform line weight, consistent visual language). Replaces the prior mixed
// emoji + Unicode glyph set which read as inconsistent.
const VISIBLE_TABS = [
  { name: 'Home',    icon: 'home',      label: 'Home' },
  { name: 'Manual',  icon: 'book-open', label: 'Manual' },
  { name: 'Village', icon: 'heart',     label: 'Village' },
  { name: 'Inbox',   icon: 'mail',      label: 'Inbox' },
  { name: 'Profile', icon: 'user',      label: 'Profile' },
] as const;

const HIDDEN_TABS = ['Milk', 'Experts', 'Gear'] as const;

const TAB_NAMES = [...VISIBLE_TABS.map((t) => t.name), ...HIDDEN_TABS] as const;

const hiddenButton = () => null;

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const isHidden = (HIDDEN_TABS as readonly string[]).includes(route.name);
        return {
          headerShown: false,
          tabBarActiveTintColor: COLORS.diner,
          tabBarInactiveTintColor: COLORS.textLight,
          tabBarStyle: {
            backgroundColor: COLORS.paper,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: 82,
            paddingBottom: 16,
            paddingTop: 10,
          },
          // Hidden tabs MUST also collapse their slot (`display:'none'`) — without
          // it the wrapper view still claims flex space and the 5 visible tabs
          // get squeezed to 5/8 of the bar with empty space on the right.
          tabBarItemStyle: isHidden
            ? { display: 'none' }
            : { paddingHorizontal: 0 },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: FONTS.bodySemiBold,
            letterSpacing: 0,
            textTransform: 'none',
            marginTop: 4,
          },
          tabBarIcon: ({ color, focused }) => {
            const tab = VISIBLE_TABS.find((t) => t.name === route.name);
            if (!tab) return null;
            return (
              <Feather
                name={tab.icon as React.ComponentProps<typeof Feather>['name']}
                size={focused ? 22 : 20}
                color={color}
              />
            );
          },
          tabBarButton: isHidden ? hiddenButton : undefined,
        };
      }}
    >
      <Tab.Screen name="Home"    component={HomeNavigator}    options={{ title: 'Home' }} />
      <Tab.Screen name="Manual"  component={ManualNavigator}  options={{ title: 'Manual' }} />
      <Tab.Screen name="Village" component={VillageNavigator} options={{ title: 'Village' }} />
      <Tab.Screen name="Inbox"   component={InboxNavigator}   options={{ title: 'Inbox' }} />
      <Tab.Screen name="Profile" component={MeNavigator}      options={{ title: 'Profile' }} />
      {/* Hidden — preserves existing deeplinks. */}
      <Tab.Screen name="Milk"    component={MilkNavigator} />
      <Tab.Screen name="Experts" component={ExpertsNavigator} />
      <Tab.Screen name="Gear"    component={GearNavigator} />
    </Tab.Navigator>
  );
}

export type TabName = (typeof TAB_NAMES)[number];
