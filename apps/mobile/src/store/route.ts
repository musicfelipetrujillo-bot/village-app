import { create } from 'zustand';

// Tracks the deepest active route name, published from RootNavigator's
// onStateChange (which already walks the nav tree for analytics). Components
// that need to react to "which screen is on top" — e.g. the FloatingHelpButton
// hiding itself on Home — read from here instead of useNavigationState, which
// doesn't reliably re-render for nested tab/stack navigation.
type RouteState = {
  currentRoute: string | null;
  setCurrentRoute: (name: string | null) => void;
};

export const useRouteStore = create<RouteState>((set) => ({
  currentRoute: null,
  setCurrentRoute: (name) => set((s) => (s.currentRoute === name ? s : { currentRoute: name })),
}));
