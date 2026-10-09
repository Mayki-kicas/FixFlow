import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "FixFlow - Maintenance Tickets",
  description: "Plateforme de gestion de maintenance interne",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e8513b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const current = await getCurrentUser();
  const user = current
    ? { id: current.id, displayName: current.displayName, email: current.email, role: current.role }
    : null;

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans text-foreground antialiased">
        <Providers>
          <AppShell user={user}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
