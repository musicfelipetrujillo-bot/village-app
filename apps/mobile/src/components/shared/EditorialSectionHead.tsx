// Editorial section head — numbered rust Playfair italic numeral on the
// left, uppercase eyebrow + Playfair title on the right, and a hairline
// rule that grows from the eyebrow to the right edge of the screen.
// Mirrors the `.section-head` + `.row-label` pattern from the Specialist
// Card Concepts artifact: roman numerals (`I.` `II.` `III.`) hold print
// rhythm, the trailing rule turns each section into a column. Use only
// at section breaks — overuse drops the magazine effect.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

type Props = {
  /** Roman numeral or single letter shown in rust italic. */
  numeral?: string;
  /** Uppercase, letter-spaced eyebrow above the title. */
  eyebrow: string;
  /** Optional Playfair title rendered below the eyebrow. */
  title?: string;
  /** Optional CTA text on the right of the eyebrow row (e.g. "See all"). */
  rightLabel?: string;
  onRightPress?: () => void;
};

export function EditorialSectionHead({
  numeral, eyebrow, title, rightLabel, onRightPress,
}: Props) {
  return (
    <View style={styles.root}>
      {numeral ? <Text style={styles.numeral}>{numeral}</Text> : null}
      <View style={styles.body}>
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <View style={styles.rule} />
          {rightLabel ? (
            <Text
              onPress={onRightPress}
              style={styles.rightLabel}
              accessibilityRole={onRightPress ? 'button' : undefined}
            >
              {rightLabel}
            </Text>
          ) : null}
        </View>
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
    gap: 14,
  },
  numeral: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 30,
    color: COLORS.coco,
    marginTop: -2, // baseline-align with the eyebrow's cap-height
  },
  body: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.8,
    color: COLORS.barkSoft,
    textTransform: 'uppercase',
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(122,104,87,0.30)',
  },
  rightLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.coco,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: FONTS.header,
    fontSize: 26,
    lineHeight: 30,
    color: COLORS.bark,
    marginTop: 6,
    letterSpacing: -0.2,
  },
});

export default EditorialSectionHead;
