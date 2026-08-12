import type { ToolContext, ToolDef } from './types.ts';
import { getBabyTrackingStats } from './getBabyTrackingStats.ts';
import { findSpecialists } from './findSpecialists.ts';
import { searchGear } from './searchGear.ts';
import { findDonors } from './findDonors.ts';
import { findEvents } from './findEvents.ts';
import { findDaycares } from './findDaycares.ts';
import { navigate } from './navigate.ts';
import { logBabyEvent } from './logBabyEvent.ts';
import { logMilkStash } from './logMilkStash.ts';
import { draftDaySheet } from './draftDaySheet.ts';
import { rememberFact } from './rememberFact.ts';
import { saveItem } from './saveItem.ts';
// Wave 3 — read tranche A. Consolidated by how a mom asks, not by table: Billy
// runs on Haiku, so one schema per capability would have taken him past 60.
import { getMyDay } from './getMyDay.ts';
import { getMyWeek } from './getMyWeek.ts';
import { readManual } from './readManual.ts';
import { getMyHome } from './getMyHome.ts';
import { getSaved } from './getSaved.ts';

const REGISTRY: ToolDef[] = [
  getBabyTrackingStats, findSpecialists, searchGear, findDonors, findEvents, findDaycares,
  navigate, logBabyEvent, logMilkStash, draftDaySheet, rememberFact, saveItem,
  getMyDay, getMyWeek, readManual, getMyHome, getSaved,
];
const BY_NAME = new Map(REGISTRY.map((t) => [t.schema.name, t]));
export const TOOLS = REGISTRY.map((t) => t.schema);
export async function dispatch(name: string, ctx: ToolContext, input: any): Promise<unknown> {
  const tool = BY_NAME.get(name);
  if (!tool) return { error: 'unknown_tool' };
  try { return await tool.handler(ctx, input); }
  catch (e) { return { error: String(e) }; }
}
