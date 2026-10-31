import { BotRouterBridge } from '@/components/BotRouterBridge';
import { WidgetMount } from '@/components/WidgetMount';

// 2026-10-31 redesign: the marketing site is light-only (the .mk scope re-sets
// the colour tokens and switches off dark: styles); the dashboard keeps its theme.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BotRouterBridge />
      <div className="mk min-h-screen">{children}</div>
      <WidgetMount merchantId="SM-XPK2EN" />
    </>
  );
}
