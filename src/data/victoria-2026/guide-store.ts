import sources from "./sources.json";

export type SourceKind =
  | "independent"
  | "government"
  | "legislation"
  | "media"
  | "research"
  | "party"
  | "author";

export interface SourceRecord {
  title: string;
  publisher: string;
  url: string;
  kind: SourceKind;
  published?: string;
  checked: string;
  establishes: string;
}

export const sourceRecords = sources as Record<string, SourceRecord>;

export const sourceKindLabels: Record<SourceKind, string> = {
  independent: "Independent finding",
  government: "Government source",
  legislation: "Legislation or rules",
  media: "Reporting",
  research: "Research",
  party: "Party document",
  author: "Author calculation",
};

interface CiteEntry {
  key: string;
  number: number;
  uses: number;
}

interface GuideStore {
  order: string[];
  entries: Map<string, CiteEntry>;
}

const stores = new WeakMap<object, GuideStore>();
let fallbackStore: GuideStore | undefined;

function freshStore(): GuideStore {
  return { order: [], entries: new Map() };
}

/**
 * One citation registry per rendered page. Astro.locals is a per-request object,
 * so keying on it keeps dev-server renders from accumulating numbers.
 */
export function getGuideStore(locals: unknown): GuideStore {
  if (locals && typeof locals === "object") {
    let store = stores.get(locals);
    if (!store) {
      store = freshStore();
      stores.set(locals, store);
    }
    return store;
  }
  fallbackStore ??= freshStore();
  return fallbackStore;
}

export function resetGuideStore(locals: unknown) {
  if (locals && typeof locals === "object") stores.set(locals, freshStore());
  else fallbackStore = freshStore();
}

export function registerCitation(locals: unknown, key: string) {
  if (!(key in sourceRecords)) {
    throw new Error(`Unknown election-guide source key: ${key}`);
  }
  const store = getGuideStore(locals);
  let entry = store.entries.get(key);
  if (!entry) {
    entry = { key, number: store.order.length + 1, uses: 0 };
    store.entries.set(key, entry);
    store.order.push(key);
  }
  entry.uses += 1;
  return { ...entry, record: sourceRecords[key] };
}

export function listCitations(locals: unknown) {
  const store = getGuideStore(locals);
  return store.order.map((key) => ({ ...store.entries.get(key)!, record: sourceRecords[key] }));
}
