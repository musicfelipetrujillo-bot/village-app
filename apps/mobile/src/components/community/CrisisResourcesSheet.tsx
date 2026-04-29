// V3 Phase C4 — Crisis resources bottom sheet.
// Shown when:
//   - a user's own room message comes back as `ai_scan_status='crisis'`
//   - a user taps "I need help now" from a room or Me screen
//
// All resources are `tel:` or `sms:` deep-links — the app never mediates the
// conversation itself. Matches the Risk & Compliance doc's crisis-resource
// posture (reach in ≤2 taps, no app barriers).

import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FONTS } from '@utils/constants';
import { useT } from '@/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optional lead text — e.g. when Villie detected crisis language. */
  lead?: string;
}

type Action =
  | { type: 'tel'; value: string }
  | { type: 'sms'; value: string; body?: string };

interface Resource {
  /** Org names are proper nouns — kept English in both locales. */
  title: string;
  /** Subtitle key under `crisis.*` — localized at render time. */
  subtitleKey: string;
  action: Action;
  accent: string;
}

const RESOURCES: Resource[] = [
  {
    title: '988 Suicide & Crisis Lifeline',
    subtitleKey: 'crisis.subtitle988',
    action: { type: 'tel', value: '988' },
    accent: '#D87530',
  },
  {
    title: 'Crisis Text Line',
    subtitleKey: 'crisis.subtitle741741',
    action: { type: 'sms', value: '741741', body: 'HOME' },
    accent: '#5C6B3A',
  },
  {
    title: 'Postpartum Support International',
    subtitleKey: 'crisis.subtitlePsi',
    action: { type: 'tel', value: '18009444773' },
    accent: '#C4A35A',
  },
  {
    title: '911 — Emergency',
    subtitleKey: 'crisis.subtitle911',
    action: { type: 'tel', value: '911' },
    accent: '#9A4A2B',
  },
];

function buildUrl(action: Action): string {
  if (action.type === 'tel') return `tel:${action.value}`;
  // iOS uses `&body=` after the number; Android uses `?body=`.
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const body = action.body ? `${sep}body=${encodeURIComponent(action.body)}` : '';
  return `sms:${action.value}${body}`;
}

function formatPhoneForDisplay(action: Action): string {
  if (action.type === 'sms') {
    return action.body ? `Text ${action.body} to ${action.value}` : `Text ${action.value}`;
  }
  // Render 11-digit US numbers as 1-800-XXX-XXXX so a partner can dial from
  // a landline; short codes (988, 911) pass through.
  const v = action.value;
  if (v.length === 11) return `${v.slice(0, 1)}-${v.slice(1, 4)}-${v.slice(4, 7)}-${v.slice(7)}`;
  return v;
}

export default function CrisisResourcesSheet({ visible, onClose, lead }: Props) {
  const t = useT();

  const open = (action: Action) => {
    const url = buildUrl(action);
    Linking.openURL(url).catch(() => {
      // Don't fail silently — if the device can't open tel:/sms: (e.g. iPad
      // without SIM, simulator), give the user the number to dial manually
      // and keep the sheet open so they can long-press to copy.
      const number = formatPhoneForDisplay(action);
      Alert.alert(
        t('crisis.cantConnectTitle'),
        action.type === 'sms'
          ? t('crisis.cantConnectText', { number })
          : t('crisis.cantConnectCall', { number }),
        [{ text: 'OK', style: 'cancel' }],
      );
    });
  };

  // Long-press copies the number to clipboard so a tired user can paste it
  // into another phone or pass it to a partner without retyping.
  const copy = async (action: Action, label: string) => {
    try {
      await Clipboard.setStringAsync(action.value);
      Alert.alert(
        t('crisis.copiedTitle'),
        t('crisis.copiedBody', { label, number: formatPhoneForDisplay(action) }),
      );
    } catch {
      // Clipboard failures are non-fatal — the user can still tap to dial.
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('crisis.sheetTitle')}</Text>
          <Text style={styles.subtitle}>
            {lead ?? t('crisis.sheetLead')}
          </Text>
          {RESOURCES.map((r, i) => {
            const subtitle = t(r.subtitleKey);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.card, { borderLeftColor: r.accent }]}
                onPress={() => open(r.action)}
                onLongPress={() => copy(r.action, r.title)}
                delayLongPress={400}
                accessibilityLabel={`${r.title}. ${subtitle}`}
                accessibilityHint={
                  r.action.type === 'sms'
                    ? t('crisis.a11yTextHint')
                    : t('crisis.a11yCallHint')
                }
                accessibilityRole="button"
              >
                <Text style={styles.cardTitle}>{r.title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
                <Text style={styles.cardHint}>
                  {r.action.type === 'sms'
                    ? t('crisis.tapToTextHoldToCopy')
                    : t('crisis.tapToCallHoldToCopy')}
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.footer}>
            {t('crisis.sheetFooter')}
          </Text>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            accessibilityLabel={t('crisis.sheetCloseA11y')}
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>{t('crisis.sheetClose')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,16,8,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FDFAF5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#9A8070',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.bodySemiBold,
    color: '#1C1008',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#5A3E28',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 10,
    minHeight: 64, // larger tap target — motor control may be impaired in crisis
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONTS.bodySemiBold,
    color: '#1C1008',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#5A3E28',
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 11,
    color: '#9A8070',
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 0.2,
  },
  footer: {
    fontSize: 11,
    color: '#9A8070',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  close: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemiBold,
    color: '#D87530',
  },
});
