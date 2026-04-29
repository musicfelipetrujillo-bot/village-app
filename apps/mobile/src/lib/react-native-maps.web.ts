// Web stub for react-native-maps. Maps are native-only; on web we render
// nothing so the rest of the app can still bundle for dev preview.
import React from 'react';
import { View } from 'react-native';

const Noop = (props: any) => React.createElement(View, props, props?.children ?? null);

export const Marker = Noop;
export const Callout = Noop;
export const Polyline = Noop;
export const Polygon = Noop;
export const Circle = Noop;
export const Overlay = Noop;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

export default Noop;
