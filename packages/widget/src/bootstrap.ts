export type BootstrapInput = {
  apiBase: string;
  merchantId: string;
  domain: string;
};

export type BootstrapResult =
  | { kind: 'ok'; sessionId: string; wsUrl: string; merchantStatus: string }
  | { kind: 'err'; reason: string };

export async function bootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  try {
    const installRes = await fetch(`${input.apiBase}/v1/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantId: input.merchantId,
        domain: input.domain,
        userAgent: navigator.userAgent,
        referrer: document.referrer || null,
      }),
    });
    if (!installRes.ok) return { kind: 'err', reason: `install_${installRes.status}` };
    const installBody = (await installRes.json()) as { status: string };

    const sessionRes = await fetch(`${input.apiBase}/v1/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchantId: input.merchantId, domain: input.domain }),
    });
    if (!sessionRes.ok) return { kind: 'err', reason: `session_${sessionRes.status}` };
    const sessionBody = (await sessionRes.json()) as { sessionId: string; wsUrl: string };
    return {
      kind: 'ok',
      sessionId: sessionBody.sessionId,
      wsUrl: sessionBody.wsUrl,
      merchantStatus: installBody.status,
    };
  } catch (err) {
    return { kind: 'err', reason: err instanceof Error ? err.message : 'network' };
  }
}
