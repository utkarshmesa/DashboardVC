export type SpikeVc = {
  id: string;
  name: string;
  firm: string;
  aliases: string[];
  firmAliases: string[];
  ambiguous: boolean;
  trust: string;
  tier: number | null;
  rssUrl: string | null;
  firmRss: string | null;
};

export type GoldenEvent = {
  id: string;
  company: string;
  firm: string;
  tracked_vc: string;
  expected_types: string[];
  competitor_under_default_persona: boolean;
};

export type QueryKind = 'google_news' | 'google_news_appearance' | 'tavily' | 'golden';

export type Labels = {
  about_this_vc: boolean;
  confidence: number;
  subject: 'person' | 'firm';
  signal_type: 'investment' | 'authored' | 'speaking' | 'press' | 'other' | 'irrelevant';
  relevance: number;
  possible_competitor: boolean;
  competitor_evidence: string | null;
  role_change_hint: string | null;
  event_key: string;
  summary: string;
  hook: string | null;
};

export type Item = {
  item_id: number;
  vc_id: string;
  url: string;
  url_hash: string;
  title: string;
  title_norm: string;
  snippet: string | null;
  source_name: string | null;
  published_at: string | null;
  date_approx: boolean;
  sources: QueryKind[];
  status: 'pending' | 'accepted' | 'rejected' | 'unclassified';
  reject_reason: string | null;
  labels: Labels | null;
  hook_dropped: boolean;
  competitor_cleared: boolean;
};
