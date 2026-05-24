// Tab IA — v3 brand kit (2026-05-24): 5 visible slots, 3 LOCKED + 2
// USER-PICKABLE per the design handoff. Home / Manual / Profile are
// always in positions 1 / 2 / 5. The two middle slots are chosen by
// the user from { Village, Inbox, Experts, Milk, Gear } via the
// `useCustomMiddleTabs` hook (defaults to ['Village', 'Inbox'] so
// current behavior is preserved until the user changes it).
//
// All 5 customizable pillars stay registered as Tab.Screen so
// cross-tab deep-links (`navigation.getParent().navigate('Milk', { screen: ... })`)
// keep working regardless of which two the user has surfaced.
// Whichever pillars aren't in the user's pair get `tabBarButton: () => null`
// so they collapse out of the bar but stay routable.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useHomeStore } from '@store/home';
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
import { useCustomMiddleTabs } from '@/hooks/useCustomMiddleTabs';

const Tab = createBottomTabNavigator();

// All tabs that can EVER appear in the bar. Order matters only as the
// reference list; actual ordering is computed from LOCKED + user pick.
const TAB_META = {
  Home:    { icon: 'home',      label: 'Home' },
  Manual:  { icon: 'book-open', label: 'Manual' },
  Village: { icon: 'heart',     label: 'Village' },
  Inbox:   { icon: 'mail',      label: 'Inbox' },
  Experts: { icon: 'check-circle', label: 'Specialists' },
  Milk:    { icon: 'droplet',   label: 'Milk' },
  Gear:    { icon: 'shopping-bag', label: 'Gear' },
  Profile: { icon: 'user',      label: 'Profile' },
} as const;

type TabKey = keyof typeof TAB_META;

const LOCKED_LEFT: readonly TabKey[] = ['Home', 'Manual'];
const LOCKED_RIGHT: readonly TabKey[] = ['Profile'];
const ALL_PILLAR_KEYS: readonly TabKey[] = ['Village', 'Inbox', 'Experts', 'Milk', 'Gear'];

const TAB_NAMES = [...LOCKED_LEFT, ...ALL_PILLAR_KEYS, ...LOCKED_RIGHT] as const;

const hiddenButton = () => null;

export function AppNavigator() {
  const unreadNotifCount = useHomeStore((s) => s.unreadNotifCount);
  const { tabs: middleTabs } = useCustomMiddleTabs();

  // Visible set = LOCKED_LEFT + user's middle pair + LOCKED_RIGHT.
  // All other pillars collapse but stay routable.
  const visibleSet = new Set<TabKey>([...LOCKED_LEFT, ...middleTabs, ...LOCKED_RIGHT]);
  const isVisible = (name: string) => visibleSet.has(name as TabKey);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const hidden = !isVisible(route.name);
        return {
          headerShown: false,
          // 150ms opacity crossfade on tab switch — softer than the default
          // instant cut; keeps the warm palette feel between surfaces.
          animation: 'fade' as const,
          // v2 brand kit: tab-label · Plus Jakarta 500 · cinnamon active / amber idle
          tabBarActiveTintColor: COLORS.v2_cinnamon,
          tabBarInactiveTintColor: COLORS.v2_amber,
          tabBarStyle: {
            backgroundColor: COLORS.v2_card,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: 82,
            paddingBottom: 16,
            paddingTop: 10,
          },
          // Hidden tabs MUST also collapse their slot (`display:'none'`) — without
          // it the wrapper view still claims flex space and the visible tabs
          // get squeezed with empty space on the side.
          tabBarItemStyle: hidden
            ? { display: 'none' }
            : { paddingHorizontal: 0 },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: FONTS.v2_label,
            letterSpacing: 0.1,
            textTransform: 'none',
            marginTop: 4,
          },
          tabBarIcon: ({ color, focused }) => {
            const meta = TAB_META[route.name as TabKey];
            if (!meta) return null;
            return (
              <Feather
                name={meta.icon as React.ComponentProps<typeof Feather>['name']}
                size={focused ? 22 : 20}
                color={color}
              />
            );
          },
          tabBarButton: hidden ? hiddenButton : undefined,
        };
      }}
    >
      {/* Locked left */}
      <Tab.Screen name="Home"    component={HomeNavigator}    options={{ title: 'Home' }} />
      <Tab.Screen name="Manual"  component={ManualNavigator}  options={{ title: 'Manual' }} />
      {/* All pillars registered; visibility comes from useCustomMiddleTabs. */}
      <Tab.Screen name="Village" component={VillageNavigator} options={{ title: 'Village' }} />
      <Tab.Screen name="Inbox"   component={InboxNavigator}   options={{ title: 'Inbox' }} />
      <Tab.Screen name="Experts" component={ExpertsNavigator} options={{ title: TAB_META.Experts.label }} />
      <Tab.Screen name="Milk"    component={MilkNavigator}    options={{ title: TAB_META.Milk.label }} />
      <Tab.Screen name="Gear"    component={GearNavigator}    options={{ title: TAB_META.Gear.label }} />
      {/* Locked right */}
      <Tab.Screen
        name="Profile"
        component={MeNavigator}
        options={{
          title: 'Profile',
          tabBarBadge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.v2_cinnamon, color: COLORS.v2_card, fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
      />
    </Tab.Navigator>
  );
}

export type TabName = (typeof TAB_NAMES)[number];
