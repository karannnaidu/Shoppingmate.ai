// Shared customer-intent data contract. Lives in @shoppingmate/shared (the
// lowest package both `agent` and `db` depend on) so the session-end profiler
// (agent) and the visitor-profile store (db) can share these types WITHOUT a
// circular dependency — `agent` already depends on `db`, so `db` must not
// depend on `agent`.

export const INTENTS = [
  'browsing', 'researching', 'comparing', 'ready_to_buy', 'price_sensitive',
  'support_issue', 'medical_consult', 'bulk_b2b', 'post_purchase',
] as const;
export type Intent = (typeof INTENTS)[number];

export type ConversationFacts = {
  cartAdds: number;
  checkoutReached: boolean;
  purchased: boolean;
  mode: 'voice' | 'text';
};

export type IntentRecord = {
  intent: Intent;
  intentConfidence: number;
  needs: string[];
  objections: string[];
  preferences: { products?: string[]; flavours?: string[]; blissClub?: boolean; coupon?: string };
  affect: { sentiment: 'positive' | 'neutral' | 'negative'; confused?: boolean };
  identity: { name?: string; phone?: string; email?: string; city?: string; pincode?: string; age?: number; language?: string };
  dropStage: string | null;
};
