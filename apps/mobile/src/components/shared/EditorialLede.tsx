// Editorial lede — large italic Playfair paragraph that introduces a
// section the way a magazine page opens under its title. Mirrors the
// `.lede` class in `/tmp/village-design/.../Villie - Specialist Card
// Concepts.html` (22px italic Playfair, line-height 1.5, inkSoft color).
// Used directly under page titles on Home, Experts, Milk, Gear list
// screens to set tone before the first card.
import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

type Props = {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
};

export function EditorialLede({ children, style }: Props) {
  return <Text style={[styles.lede, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  lede: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 25,
    color: COLORS.barkSoft,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
  },
});

export default EditorialLede;
