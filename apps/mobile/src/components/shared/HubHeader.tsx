// HubHeader — kept as a thin alias over ScreenHeader so the four verticals
// (Milk / Care / Gear / Plans) render the EXACT same header as every other
// screen. It used to be its own bold 28px "name + dot" masthead, which is why
// Milk looked different from Care/Gear/Plans. Now there is one header, period.
// The `dotColor` prop is accepted but ignored (call sites keep compiling).
import React from 'react';
import { ScreenHeader } from './ScreenHeader';

export function HubHeader({
  name,
  onBack,
  right,
  backAccessibilityLabel,
}: {
  name: string;
  dotColor?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  backAccessibilityLabel?: string;
}) {
  return <ScreenHeader title={name} onBack={onBack} right={right} />;
}

export default HubHeader;
