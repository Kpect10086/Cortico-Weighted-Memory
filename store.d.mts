export interface MemoryRow { id: string; scope: string; text: string; kind: string; importance: number; reason: string; source: string; createdAt: number; state: string; processed: number; metadata: string }
export const DEFAULTS: { maxChars: number; coreChars: number; recentChars: number; recallChars: number; recentDays: number; summaryIntervalMinutes: number; singleThreshold: number };
export const MEMORY_WEIGHT_GUIDE: string;
export function chars(text: string): number;
export function key(text: string): string;
export function eventScopes(event: { source: string; senderKey?: string; meta?: Record<string, unknown> }): string[];
export function isMemoryEvent(event: {origin?:string;source:string;type:string;text?:string}): boolean;
export class MemoryStore {
  constructor(file: string);
  db: import('node:sqlite').DatabaseSync;
  put(row: { id?: string; scope: string; text: string; source: string; kind?: string; importance?: number; reason?: string; createdAt?: number; state?: string; processed?: number; metadata?: Record<string, unknown> }): string;
  get(id: string): MemoryRow | undefined;
  eventRecord(source: string): string | undefined;
  archiveEvent(event: {scope:string;text:string;source:string;createdAt:number;run:string}): string;
  compactPendingEvents(): {sources:number;segments:number};
  search(query: string, scopes: string[], limit?: number, now?:number): MemoryRow[];
  captureMessage(input: {source:string;scope:string;text:string;createdAt:number;run?:string;speaker?:string}): void;
  remember(row: { text: string; sourceId?: string; sourceIds?: string[]; sourceMessageIds?: string[]; occurredAt?: string|null; timeConfidence?:number; timezone?:string; category?:string; importance: number; reason: string; kind: string }, scopes: string[], threshold?:number): string;
  manual(input: {text:string;scope:string;sourceType:string;kind:string;importance:number;reason:string;occurredAt?:string|null;effectiveAt?:string|null;tags?:string[];threshold?:number}): string;
  batchReview(items:Array<{id:string;revision:string}>,state:string,reason:string,threshold?:number): {count:number};
  restructure(items:Array<{id:string;revision:string}>,parts:Array<Parameters<MemoryStore['manual']>[0]>,reason:string): {ids:string[]};
  rollback(id:string,revision:string,reason:string): {ok:boolean};
  exportAll(approvedOnly?:boolean): {md:string;jsonl:string;count:number};
  importAll(jsonl:string): {count:number};
  review(id: string, state: string, reason: string, revision?: string, threshold?:number): void;
  correct(id: string, text: string, importance: number, reason: string, revision: string, changes?:Record<string,unknown>): string;
  pendingEvents(limit?: number): MemoryRow[];
  pack(scopes: string[], query: string, options?: Partial<typeof DEFAULTS>, now?: number): { text: string; intro: string; entries: {id:string;text:string}[]; chars: number; records: number };
  stats(): { total: number; pendingSummary: number; oldestPendingAt: number | null; kinds: unknown[] };
  close(): void;
}
