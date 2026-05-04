import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "shoppingmate.ai — Your AI salesmate for every storefront",
  description:
    "Paste one script tag. A voice + text AI sales agent that builds carts, applies coupons, and hands off to checkout — on Shopify, WooCommerce, Magento, Wix, Squarespace, and custom sites.",
  metadataBase: new URL("https://shoppingmate.ai"),
  openGraph: {
    title: "shoppingmate.ai — Your store's 24/7 AI salesmate",
    description:
      "One script tag. AI sales agent on voice + text. Works on every major commerce platform.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                const m = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && m)) document.documentElement.classList.add('dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text-primary font-sans">
        {children}
      </body>
    </html>
  );
}
