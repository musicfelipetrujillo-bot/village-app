// The Buzz — client API. Reads flow entirely through get_trending_issue /
// list_trending_archive (both plain SELECT-shaped RPCs — RLS on
// trending_issues/trending_items is the actual gate; the RPCs exist only
// to hydrate the nested items array in one round trip).
import { supabase } from '@/lib/supabase';

export type TheBuzzItemKind = 'news' | 'myth_buster';

export interface TheBuzzItem {
  id: string;
  kind: TheBuzzItemKind;
  rank: number;
  title_en: string;
  title_es: string | null;
  summary_en: string;
  summary_es: string | null;
  myth_claim_en: string | null;
  myth_claim_es: string | null;
  fact_en: string | null;
  fact_es: string | null;
  ask_provider_en: string;
  ask_provider_es: string | null;
  trend_source_name: string;
  trend_source_url: string;
  evidence_source_name: string;
  evidence_source_url: string;
}

export interface TheBuzzIssue {
  id: string;
  issue_date: string;
  title: string;
  intro: string;
  published_at: string;
  items: TheBuzzItem[];
}

export interface TheBuzzArchiveRow {
  id: string;
  issue_date: string;
  title: string;
  intro: string;
  published_at: string;
}

export const theBuzzApi = {
  async getCurrentIssue(): Promise<TheBuzzIssue | null> {
    const { data, error } = await supabase.rpc('get_trending_issue', { p_issue_id: null });
    if (error) throw new Error(error.message);
    return (data as TheBuzzIssue | null) ?? null;
  },

  async getIssueById(issueId: string): Promise<TheBuzzIssue | null> {
    const { data, error } = await supabase.rpc('get_trending_issue', { p_issue_id: issueId });
    if (error) throw new Error(error.message);
    return (data as TheBuzzIssue | null) ?? null;
  },

  async listArchive(): Promise<TheBuzzArchiveRow[]> {
    const { data, error } = await supabase.rpc('list_trending_archive');
    if (error) throw new Error(error.message);
    return (data ?? []) as TheBuzzArchiveRow[];
  },
};
