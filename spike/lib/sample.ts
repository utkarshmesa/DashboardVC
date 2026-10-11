import { VCS } from '../data/vcs.js';

// Deterministic 10-VC sample for the Vercel run: every 5th tracked VC.
export const VERCEL_SAMPLE = VCS.filter((_, i) => i % 5 === 0);
export const LOCAL_TAVILY_CAP = 30;
export const VERCEL_TAVILY_CAP = 10;
