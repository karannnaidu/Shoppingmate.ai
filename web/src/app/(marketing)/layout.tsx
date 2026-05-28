import { BotRouterBridge } from '@/components/BotRouterBridge';
import { WidgetMount } from '@/components/WidgetMount';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BotRouterBridge />
      {children}
      <WidgetMount merchantId="SM-XPK2EN" />
    </>
  );
}
