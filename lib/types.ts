export type VcStatus = 'not_contacted' | 'awaiting_response' | 'in_conversation' | 'passed';
export type FetchStatus = 'ok' | 'partial' | 'failed';
export type SignalType = 'investment' | 'authored' | 'speaking' | 'press' | 'other' | 'irrelevant';
export type Subject = 'person' | 'firm';
export type SignalStatus = 'pending' | 'accepted' | 'rejected' | 'unclassified';
export type SignalSource = 'google_news' | 'tavily' | 'person_rss' | 'firm_rss';

export type VcRow = {
  id: string;
  name: string;
  firm: string;
  thesis: string | null;
  status: VcStatus;
  last_contact_date: string | null;
  notes: string | null;
  rss_url: string | null;
  last_signal_date: string | null;
  signal_summary: string | null;
  follow_up_score: number | null;
  recommended_action: string | null;
};

// What the runner needs about one VC: its row plus profile and firm aliases.
export type VcContext = {
  id: string;
  name: string;
  firm: string;
  aliases: string[];
  firmAliases: string[];
  ambiguous: boolean;
  firmRss: string | null;
  row: VcRow;
};

export type RawItem = {
  url: string;
  title: string;
  snippet: string | null;
  source: SignalSource;
  source_name: string | null;
  published_at: string | null;
  date_approx: boolean;
};

export type NewSignal = RawItem & {
  vc_id: string;
  url_hash: string;
  title_norm: string;
  status: SignalStatus;
  reject_reason: string | null;
};

export type SignalRow = {
  id: number;
  vc_id: string;
  url: string;
  title: string;
  snippet: string | null;
  source: string;
  published_at: string | null;
  date_approx: boolean;
  status: SignalStatus;
  reject_reason: string | null;
  subject: Subject | null;
  signal_type: SignalType | null;
  about_this_vc: boolean | null;
  confidence: number | null;
  relevance: number | null;
  possible_competitor: boolean | null;
  competitor_evidence: string | null;
  funded_company: string | null;
  role_change_hint: string | null;
  event_key: string | null;
  summary: string | null;
  enriched_run: string | null;
};

export type Labels = {
  about_this_vc: boolean;
  confidence: number;
  subject: Subject;
  signal_type: SignalType;
  relevance: number;
  possible_competitor: boolean;
  competitor_evidence: string | null;
  funded_company: string | null;
  role_change_hint: string | null;
  event_key: string;
  summary: string;
};

export type LabelUpdate = Labels & { id: number; status: SignalStatus; reject_reason: string | null };
