// Root NavigationContainer ref — the canonical "navigate from anywhere"
// escape hatch. Used by surfaces whose own navigation prop can be mid-
// dismissal when they need to dispatch (e.g. Billy's chat modal deep-links:
// tapping a CTA pill navigates the tabs UNDER the modal while the modal is
// closing — dispatching here can't be cancelled by that screen unmounting).
// Lives in its own module so screens can import it without a require cycle
// through RootNavigator.
import { createNavigationContainerRef } from '@react-navigation/native';

// Exported as `any`: consumed by independent surfaces (Billy chat CTAs +
// deep-links) whose targets span every tab's stack — no RootParamList union
// is exported today, and v7's tuple-typed navigate() rejects both untyped
// and `as never`-cast calls otherwise. Runtime shape is the real ref.
export const navigationRef: any = createNavigationContainerRef();
