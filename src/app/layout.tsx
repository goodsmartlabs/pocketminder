import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PocketMinder — Your brain for the dates you can't afford to forget",
    template: "%s · PocketMinder",
  },
  description:
    "PocketMinder remembers expiries, renewals, deadlines and important dates so you don't have to. Put it in your pocket. Get it out of your head.",
  applicationName: "PocketMinder",
  appleWebApp: { capable: true, title: "PocketMinder", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121416" },
  ],
};

// Apply a saved light/dark choice before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("pm-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
