import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import { db } from "@/lib/store";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Wait? Kyu? Find a shorter wait", template: "%s · Wait? Kyu?" },
  description: "See live waiting times at nearby businesses and join the queue before you arrive.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffc21a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { platformName, announcement, supportEmail } = db.settings;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header name={platformName} announcement={announcement} />
        <main className="flex-1">{children}</main>
        <footer className="mt-10 border-t border-black/10 bg-[#f3eee3] print:hidden">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Logo tagline />
              <p className="mt-2 max-w-sm text-muted">Never wait blindly again. Live waiting times and remote queues for the businesses around you.</p>
            </div>
            <div className="space-y-2"><p className="font-semibold">Customers</p>
              <Link className="block text-muted hover:text-foreground" href="/search">Explore</Link>
              <Link className="block text-muted hover:text-foreground" href="/login">Sign in</Link>
              <Link className="block text-muted hover:text-foreground" href="/account">My account</Link></div>
            <div className="space-y-2"><p className="font-semibold">Businesses</p>
              <Link className="block text-muted hover:text-foreground" href="/merchant/onboarding">List your business</Link>
              <Link className="block text-muted hover:text-foreground" href="/merchant/login">Dashboard</Link>
              <a className="block text-muted hover:text-foreground" href={`mailto:${supportEmail}`}>Contact support</a></div>
          </div>
          <div className="border-t border-black/10 py-4 text-center text-xs text-muted">
            © {new Date().getFullYear()} {platformName} · Photography by <a className="underline" href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a> contributors · Map © OpenStreetMap
          </div>
        </footer>
      </body>
    </html>
  );
}
