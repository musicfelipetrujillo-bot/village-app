import type { ToolDef } from './types.ts';

// Allowlist of route-to destinations. Keys are Billy-facing; the mobile client
// maps each to a concrete React Navigation target (see AIHelpChatScreen).
export const NAV_TARGETS = [
  'booking', 'gear_create', 'box_checkout', 'gear_boost',
  'become_donor', 'donor_profile_edit', 'appointment_book', 'account_settings',
  'baby_profile_setup', 'playbook',
  // Wave 2 route batch
  'write_review', 'message_specialist', 'create_milk_listing', 'milk_messages',
  'vault_create_listing', 'gear_status', 'gear_messages', 'report_gear',
  'day_sheet', 'milk_vault',
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
      "('box_checkout' — when she names a specific box, ALSO pass params {box:'newborn'|'delivery'|'mama'} " +
      "so she lands on that box), boost a listing ('gear_boost'), become a milk donor ('become_donor'), edit her " +
      "donor profile ('donor_profile_edit'), change account settings ('account_settings'), " +
      "write a specialist review ('write_review'), message a provider ('message_specialist'), " +
      "post a milk listing ('create_milk_listing'), open her milk messages ('milk_messages'), " +
      "sell or donate stashed vault milk ('vault_create_listing'), manage her gear listings / mark one " +
      "sold ('gear_status'), open her gear messages ('gear_messages'), report a gear listing " +
      "('report_gear'), review / edit / share her caregiver day sheets ('day_sheet'), open her " +
      "private Milk Vault freezer-stash dashboard ('milk_vault'), or " +
      "set up her baby's profile / baby card ('baby_profile_setup') — use this whenever she needs a " +
      "baby profile before you can log naps/feeds/diapers. " +
      "Navigation only happens when SHE taps the button under your reply — never say you're " +
      "taking her there now. Tell her what the button opens and what she'll do on that screen " +
      "(e.g. \"Tap below to open the donor signup — you'll answer a quick questionnaire there.\"). " +
      "NEVER promise a screen the button does not open. Several destinations are deliberately one " +
      "step up from the thing she asked for, because the exact screen needs an id you don't have — " +
      "name the landing screen and the tap she makes there:\n" +
      "· 'gear_boost' opens HER GEAR LISTINGS (not a checkout). Say: \"opens your listings — find the " +
      "stroller and tap Boost.\" Never describe a duration picker, a fee, or a confirm step.\n" +
      "· 'report_gear' opens GEAR BROWSE. Say: \"opens Gear — open the listing and use Report from there.\"\n" +
      "· 'booking' / 'appointment_book' / 'message_specialist' / 'write_review' open the CARE DIRECTORY. " +
      "Say: \"opens Care — pick your provider and you'll book/message/review from their profile.\"\n" +
      "· 'create_milk_listing' opens her DONOR LISTING MANAGER — she taps + there to post.\n" +
      "· 'milk_messages' / 'gear_messages' open the THREAD LIST, not a composer.",
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: NAV_TARGETS as unknown as string[], description: 'The destination.' },
        params: { type: 'object', description: 'Optional pre-fill hints, e.g. { specialist_name, category }.' },
      },
      required: ['screen'],
    },
  },
  handler: async (_ctx, input) => {
    const screen = String(input?.screen ?? '');
    if (!(NAV_TARGETS as readonly string[]).includes(screen)) return { error: 'unknown_screen' };
    return { __navigate: { screen, params: input?.params ?? {} } };
  },
};
