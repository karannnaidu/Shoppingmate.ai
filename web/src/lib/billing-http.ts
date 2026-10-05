import { NextResponse } from 'next/server';

/**
 * Billing action routes are hit two ways:
 *  - a native HTML <form method="post"> on the billing page (browser navigation)
 *  - fetch()/programmatic callers (OnboardingWizard, tests)
 *
 * A browser form navigation sends `Accept: text/html`; fetch does not. We use
 * that to decide the response shape: redirect the browser to the Razorpay
 * hosted page (so the button actually works), but return JSON to fetch/tests.
 */
export function wantsRedirect(req: Request): boolean {
  return (req.headers.get('accept') || '').includes('text/html');
}

/** Parse the request body whether it arrived as form-urlencoded or JSON. */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return (await req.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  try {
    const fd = await req.formData();
    return Object.fromEntries(fd) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 303-redirect for browser form posts; JSON for fetch/test callers. */
export function respond(req: Request, opts: { redirectTo: string; json: Record<string, unknown> }): Response {
  if (wantsRedirect(req)) return NextResponse.redirect(opts.redirectTo, 303);
  return NextResponse.json(opts.json);
}
