import { BotRouterBridge } from '@/components/BotRouterBridge';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const cdnBase = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || 'https://shoppingmate-web.vercel.app';
  return (
    <>
      <BotRouterBridge />
      {children}
      <script async src={`${cdnBase}/widget/v1.js`} data-id="SM-XPK2EN" />
    </>
  );
}
