// Custom mood-face icons replacing the Apple system emojis 😞😕😐🙂😊
// in the daily check-in. Hand-tuned line drawings in villie cocoa, sized
// to slot into the existing 36px mood-chip emoji slot. No fills, just
// strokes — matches the editorial / illustrative feel of the manual.
//
// Each face uses the same 32-viewBox so they align visually across the
// 5-step row. The eye + mouth deltas come from the brand kit's "warm but
// honest" rule: rough is downturned-eye + frown, great is crescent-eye +
// big smile, nothing is flat-out caricature.
//
// Felipe 2026-05-28: chose this over weather/flower emojis because mood
// reads cleaner when the icon shape echoes a face, not metaphor.
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

const COCOA = '#43260F';
const STROKE = 1.9;

export type MoodScore = 1 | 2 | 3 | 4 | 5;

interface Props {
  score: MoodScore;
  size?: number;
  /** Override default cocoa (e.g. for the selected/active chip with cream stroke). */
  color?: string;
}

export default function MoodFaceIcon({ score, size = 32, color = COCOA }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Outer face circle — same on every score, anchors the row */}
      <Circle cx={16} cy={16} r={14} stroke={color} strokeWidth={STROKE} fill="none" />

      {/* Eyes + mouth vary by score */}
      {score === 1 && (
        <>
          {/* Rough — tear-shaped down-eyes + deep frown */}
          <Path
            d="M9 12 L11.5 14 M13 12 L10.5 14"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
          <Path
            d="M19 12 L21.5 14 M23 12 L20.5 14"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
          <Path
            d="M10 23 Q16 18 22 23"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
        </>
      )}

      {score === 2 && (
        <>
          {/* Meh — small dot eyes + slight downturn */}
          <Circle cx={11.5} cy={13} r={1.2} fill={color} />
          <Circle cx={20.5} cy={13} r={1.2} fill={color} />
          <Path
            d="M11 22 Q16 19.5 21 22"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
        </>
      )}

      {score === 3 && (
        <>
          {/* OK — neutral dot eyes + flat mouth */}
          <Circle cx={11.5} cy={13} r={1.2} fill={color} />
          <Circle cx={20.5} cy={13} r={1.2} fill={color} />
          <Path
            d="M11 21 L21 21"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
        </>
      )}

      {score === 4 && (
        <>
          {/* Good — soft dot eyes + gentle smile */}
          <Circle cx={11.5} cy={13} r={1.2} fill={color} />
          <Circle cx={20.5} cy={13} r={1.2} fill={color} />
          <Path
            d="M11 20 Q16 23.5 21 20"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
        </>
      )}

      {score === 5 && (
        <>
          {/* Great — crescent (squinting joyful) eyes + wide smile */}
          <Path
            d="M9.5 13 Q11.5 11.5 13.5 13"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
          <Path
            d="M18.5 13 Q20.5 11.5 22.5 13"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
          <Path
            d="M10 19 Q16 25 22 19"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none"
          />
        </>
      )}
    </Svg>
  );
}
