import type { Metadata } from "next";

import "./globals.css";

import { ThemeProvider } from "../src/context/ThemeContext";
import { BankingProvider } from "../src/context/BankingContext";
import { AdminStatusProvider } from "../src/context/AdminStatusContext";
import { BalancePrivacyProvider } from "../src/context/BalancePrivacyContext";
import { BrandingProvider } from "../src/context/BrandingContext";
import AuthGate from "../src/components/auth/AuthGate";
import BackButton from "../src/components/navigation/BackButton";

export const metadata: Metadata = {
  title: "Aurex Bank",
  description: "Modern Digital Banking Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <BrandingProvider>
          <ThemeProvider>
            <BankingProvider>
              <BalancePrivacyProvider>
                <AdminStatusProvider>
                  <AuthGate>
                    <BackButton />
                    {children}
                  </AuthGate>
                </AdminStatusProvider>
              </BalancePrivacyProvider>
            </BankingProvider>
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
