// VillieBee — a bespoke, hand-authored SVG bee mascot (Route A).
//
// A clean, warm vector bee that can wear accessories per Village section
// (e.g. a surgical cap + stethoscope for Specialists). Vector, not the
// painterly PNG — fully scalable, animatable, and OTA-able. The parent wraps
// it in an Animated.View for motion; this component is static SVG.
//
// Faces RIGHT by default; pass `flip` to mirror (for two bees meeting).
import React from 'react';
import Svg, {
  Defs, RadialGradient, Stop, Ellipse, Circle, Path, Rect, G, ClipPath,
} from 'react-native-svg';

const HONEY_HI = '#F8D662';
const HONEY_LO = '#ECB22E';
const STRIPE = '#43260F';
const FACE = '#3A2410';
const TEAL = '#5FA8A0';      // scrub cap
const TEAL_DK = '#3C6F6A';
const STETH = '#46545E';     // stethoscope tubing
const STETH_DISC = '#AEB9C1';

export type BeeAccessory = 'none' | 'scrubs';

export function VillieBee({
  size = 44,
  flip = false,
  accessory = 'none',
}: {
  size?: number;
  flip?: boolean;
  accessory?: BeeAccessory;
}) {
  // Unique gradient/clip ids per instance so multiple bees in one document
  // don't cross-reference each other's url(#id) defs.
  const uid = React.useId().replace(/[:]/g, '');
  const bodyG = `bg-${uid}`;
  const clip = `cl-${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Defs>
        <RadialGradient id={bodyG} cx="40" cy="46" r="44" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={HONEY_HI} />
          <Stop offset="1" stopColor={HONEY_LO} />
        </RadialGradient>
        <ClipPath id={clip}>
          <Ellipse cx="46" cy="58" rx="27" ry="20" />
        </ClipPath>
      </Defs>

      {/* Wings — translucent, behind the body */}
      <Ellipse cx="36" cy="33" rx="17" ry="11" fill="#FFFFFF" fillOpacity={0.6}
        stroke="#F4C53C" strokeOpacity={0.45} strokeWidth={1}
        transform="rotate(-26 36 33)" />
      <Ellipse cx="55" cy="31" rx="13" ry="9" fill="#FFFFFF" fillOpacity={0.5}
        stroke="#F4C53C" strokeOpacity={0.4} strokeWidth={1}
        transform="rotate(14 55 31)" />

      {/* Stinger */}
      <Path d="M20 58 L11 54 L11 62 Z" fill={STRIPE} />

      {/* Body */}
      <Ellipse cx="46" cy="58" rx="27" ry="20" fill={`url(#${bodyG})`} />

      {/* Stripes — clipped to the body */}
      <G clipPath={`url(#${clip})`}>
        <Rect x="33" y="34" width="8.5" height="48" rx="4" fill={STRIPE} opacity={0.92}
          transform="rotate(10 37 58)" />
        <Rect x="49" y="34" width="8.5" height="48" rx="4" fill={STRIPE} opacity={0.92}
          transform="rotate(10 53 58)" />
      </G>

      {/* Antennae */}
      <Path d="M63 44 Q65 31 59 26" stroke={STRIPE} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx="58.5" cy="25" r="2.2" fill={STRIPE} />
      <Path d="M70 45 Q75 33 72 27" stroke={STRIPE} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx="72" cy="26" r="2.2" fill={STRIPE} />

      {/* Face — front-right (honey zone past the last stripe) */}
      <Circle cx="61" cy="55" r="2.5" fill={FACE} />
      <Circle cx="61.7" cy="54.2" r="0.8" fill="#FFFFFF" />
      <Circle cx="69" cy="54" r="2.5" fill={FACE} />
      <Circle cx="69.7" cy="53.2" r="0.8" fill="#FFFFFF" />
      <Path d="M60 61 Q65 65 70 60" stroke={FACE} strokeWidth={1.6} fill="none" strokeLinecap="round" />

      {/* ── Accessory: scrubs (cap + stethoscope) ───────────────────────── */}
      {accessory === 'scrubs' && (
        <>
          {/* Surgical cap over the crown */}
          <Path d="M52 44 Q66 24 82 42 Q68 50 54 47 Z" fill={TEAL} />
          <Path d="M52 44 Q66 24 82 42" stroke={TEAL_DK} strokeWidth={1.4} fill="none" />
          {/* little cap tie */}
          <Path d="M81 42 q5 2 4 7" stroke={TEAL_DK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          {/* Stethoscope — tubing drapes down the front, disc on the chest */}
          <Path d="M55 49 C49 60 53 73 63 73" stroke={STETH} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Path d="M55 49 q3 1 5 0" stroke={STETH} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Circle cx="65" cy="73" r="4.2" fill={STETH_DISC} stroke={STETH} strokeWidth={1.4} />
        </>
      )}
    </Svg>
  );
}

// A cozy coffee cup for the Plans "gathering" scene — the thing the bees
// circle up around ("classes, circles, real coffee").
export function CoffeeCup({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* steam */}
      <Path d="M10 7 q2.4 -2.2 0 -4.4" stroke="#D96C88" strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.55} />
      <Path d="M15 7 q2.4 -2.2 0 -4.4" stroke="#D96C88" strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.45} />
      {/* handle */}
      <Path d="M20 12 q4.6 0 4.6 4 q0 3.6 -4.6 3.2" stroke="#C9A36F" strokeWidth={1.9} fill="none" />
      {/* cup body */}
      <Path d="M5.5 9.5 L20.5 9.5 L18.8 22.2 a2.2 2.2 0 0 1 -2.2 1.9 L9.4 24.1 a2.2 2.2 0 0 1 -2.2 -1.9 Z"
        fill="#F3E7D2" stroke="#C9A36F" strokeWidth={1.4} />
      {/* coffee surface */}
      <Ellipse cx="13" cy="9.6" rx="7.2" ry="1.9" fill="#7A4A28" />
    </Svg>
  );
}

// A small ribbon-tied parcel for the Gear "hand-off" scene.
export function BeeParcel({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x="6" y="12" width="28" height="22" rx="3" fill="#EBDcc3" stroke="#C9A36F" strokeWidth={1.4} />
      <Rect x="6" y="12" width="28" height="7" rx="3" fill="#E0CBA8" />
      <Rect x="17" y="12" width="6" height="22" fill="#E79AAE" />
      <Path d="M20 12 q-6 -7 -10 -2 q6 1 10 2 q4 -1 10 -2 q-4 -5 -10 2 Z" fill="#E79AAE" />
    </Svg>
  );
}
