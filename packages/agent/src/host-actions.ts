export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string }
  | { type: 'point_at'; intent: string }
  | { type: 'demo_click'; intent: string };

export type HostActionResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };

export type HostActionRequest = {
  type: 'host_action_request';
  callId: string;
  action: HostAction;
};

export type HostActionResponse = {
  type: 'host_action_result';
  callId: string;
  result: HostActionResult;
};

export type PricingQuote = {
  planId: string;
  speech: string;
  card: {
    name: string;
    priceFormatted: string;
    convCount: number | null;
  };
};
