const MERCHANT_ID_RE = /^SM-[A-Z0-9]{6}$/;

export function buildInstallSnippet(merchantId: string): string {
  if (!MERCHANT_ID_RE.test(merchantId)) {
    throw new Error(`invalid merchantId: ${merchantId}`);
  }
  return `<script src="https://cdn.shoppingmate.ai/gtag.js" data-merchant="${merchantId}" async></script>`;
}
