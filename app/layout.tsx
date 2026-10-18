import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// The app's face, and now the marketing site's too — the desktop site is
// built from the brand kit, so both surfaces share one typeface. The weights
// are pinned rather than left to the variable axis because the reference draws
// 400/500/600/700 and nothing between them.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Needed so the opengraph-image/twitter-image routes resolve to absolute
  // URLs. Falls back to localhost when unset (note: `||` also covers "").
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  /*
    The description is what a link preview shows to someone who has not opened
    the app, so it is the one piece of copy that has to survive being read
    without any of the context the app itself supplies. It used to promise the
    desktop build's model — "across chains without thinking about blockchains,
    gas, or bridging" — which phase 2 inverted: the wallet signs its own
    transfers and gas is paid in BTC. A claim that far from true, in the place
    furthest from the correction, is the worst of both.
  */
  title: "MUSD Pocket — Send MUSD from your own wallet.",
  description:
    "A mobile-first MUSD wallet. Your balance is held by a wallet only you control, and every send is a real transfer you sign yourself.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
