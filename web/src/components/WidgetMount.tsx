import { SoftNavBridge } from "./SoftNavBridge";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "shoppingmate-widget": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { "data-id"?: string; "data-api"?: string },
        HTMLElement
      >;
    }
  }
}

export function WidgetMount({ merchantId }: { merchantId: string }) {
  const cdnBase =
    process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || "https://shoppingmate-web.vercel.app";
  return (
    <>
      <SoftNavBridge />
      {/* Rendered in the React tree (not appended to document.body) so it
          survives soft-nav reconciliation across route changes within the
          marketing route group. */}
      <shoppingmate-widget data-id={merchantId} suppressHydrationWarning />
      <script async src={`${cdnBase}/widget/v1.js`} data-id={merchantId} />
    </>
  );
}
