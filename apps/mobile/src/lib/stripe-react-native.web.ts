// Web stub for @stripe/stripe-react-native.
// Stripe's SDK imports native-only Codegen modules that can't bundle on web.
// These no-op stubs let the rest of the app compile for browser dev preview.
// Native builds are unaffected — Metro only resolves this file on platform=web.
import React from 'react';
import { View } from 'react-native';

const Noop = (props: any) => React.createElement(View, props, props?.children ?? null);

export const StripeProvider = Noop;

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: undefined }),
    presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
    confirmPayment: async () => ({ error: { message: 'Stripe not available on web' } }),
    createToken: async () => ({ error: { message: 'Stripe not available on web' } }),
    createPaymentMethod: async () => ({ error: { message: 'Stripe not available on web' } }),
    handleNextAction: async () => ({ error: { message: 'Stripe not available on web' } }),
    retrievePaymentIntent: async () => ({ error: { message: 'Stripe not available on web' } }),
  };
}

export default Noop;
