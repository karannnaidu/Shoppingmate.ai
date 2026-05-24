import type {
  FaqEntryRow,
  LinkLocation,
  MediaIndexRow,
  PageIntentRow,
  PageType,
  PolicyDocumentRow,
  PolicyType,
  SitePageRow,
} from '@shoppingmate/db';

export type SitePage = {
  id: string;
  url: string;
  pageType: PageType;
  title: string | null;
  h1: string | null;
  meta: Record<string, unknown>;
};

export type NavEdge = {
  fromPageId: string;
  toPageId: string;
  anchorText: string | null;
  linkLocation: LinkLocation;
};

export type PageIntent = {
  intentKey: string;
  selectorHint: string | null;
  meta: Record<string, unknown>;
};

export type FaqEntry = {
  question: string;
  answer: string;
  pageId: string | null;
  sourceUrl: string | null;
};

export type PolicyDoc = {
  policyType: PolicyType;
  summary: string;
  pageId: string;
};

export type MediaEntry = {
  mediaUrl: string;
  contentHash: string;
  originalAlt: string | null;
  generatedAlt: string | null;
  role: MediaIndexRow['role'];
};

export type SiteGraph = {
  merchantId: string;
  version: number;
  pages: SitePage[];
  navEdges: NavEdge[];
  intentsByPageId: Map<string, PageIntent[]>;
  faq: FaqEntry[];
  policies: PolicyDoc[];
  media: Map<string, MediaEntry>;
};

export type Projector<T> = (graph: SiteGraph) => T;

export function emptyGraph(merchantId: string, version = 0): SiteGraph {
  return {
    merchantId,
    version,
    pages: [],
    navEdges: [],
    intentsByPageId: new Map(),
    faq: [],
    policies: [],
    media: new Map(),
  };
}

const _typecheckRows: [SitePageRow, PageIntentRow, FaqEntryRow, PolicyDocumentRow] | null = null;
void _typecheckRows;
