// Pure (client-safe) marker for the labelled demo history (lib/demo.ts): demo rows carry "[demo]" in Vikram's notes.
export const DEMO_PREFIX = '[demo]';
export const isDemoNote = (notes: string | null | undefined) => !!notes?.startsWith(DEMO_PREFIX);
