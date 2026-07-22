import type { ToolDef } from './types.ts';

// Allowlist of route-to destinations. Keys are Billy-facing; the mobile client
// maps each to a concrete React Navigation target (see AIHelpChatScreen).
export const NAV_TARGETS = [
  'booking', 'gear_create', 'box_checkout', 'gear_boost',
  'become_donor', 'donor_profile_edit', 'appointment_book', 'account_settings',
] as const;

export const navigate: ToolDef = {
  tier: 'route',
  schema: {
    name: 'navigate',
    description:
      "Take the mom to the right screen to COMPLETE a sensitive or irreversible action herself — " +
      "anything involving payment, posting something public, booking, or account changes. " +
      "You do NOT perform these; you deep-link and she taps the final confirm. Use when she asks to " +
      "book an appointment (screen 'booking'), sell/list gear ('gear_create'), buy a Villie Box " +
      "('box_checkout'), boost a listing ('gear_boost'), become a milk donor ('become_donor'), edit her " +
      "donor profile ('donor_profile_edit'), or change account settings ('account_settings'). " +
      "In your reply, tell her you're taking her there and what she'll do on that screen.",
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: NAV_TARGETS as unknown as string[], description: 'The destination.' },
        params: { type: 'object', description: 'Optional pre-fill hints, e.g. { specialist_name, category }.' },
      },
      required: ['screen'],
    },
  },
  handler: (_ctx, input) => {
    const screen = String(input?.screen ?? '');
    if (!(NAV_TARGETS as readonly string[]).includes(screen)) return { error: 'unknown_screen' };
    return { __navigate: { screen, params: input?.params ?? {} } };
  },
};
