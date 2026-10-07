import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// V2 type system: Geist for UI + numbers, Instrument Serif italic for the 1–3
// emphasis words in a headline, Geist Mono for labels and code.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "shoppingmate.ai — Your store, finally talking back",
  description:
    "Olivia greets every shopper on your store, answers by voice or text, builds the cart, fills checkout and shows you every step. One line of code. Shopify, WooCommerce or any website.",
  metadataBase: new URL("https://shoppingmate.ai"),
  openGraph: {
    title: "shoppingmate.ai — Your store, finally talking back",
    description:
      "A voice + text shopping assistant that sells on your store and shows its work. Installs in 60 seconds.",
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
      className={`${geist.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Dark-first product: default to dark everywhere unless the
                // user explicitly chose light via the toggle. (A system-pref
                // default made the dashboard render light inconsistently.)
                const t = localStorage.getItem('theme');
                if (t !== 'light') document.documentElement.classList.add('dark');
              } catch(e) { document.documentElement.classList.add('dark'); }
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
