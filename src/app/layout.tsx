import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "WAVEO — Previsão de ondas em Portugal",
    template: "%s · WAVEO",
  },
  description:
    "Previsão de surf para as principais praias de Portugal: altura e período de ondulação, vento, maré e uma pontuação transparente que diz se vale a pena ir agora e qual a melhor janela do dia.",
  applicationName: "WAVEO",
  keywords: [
    "surf",
    "previsão de ondas",
    "Portugal",
    "ondulação",
    "maré",
    "vento",
    "Matosinhos",
    "Peniche",
    "Ericeira",
  ],
  authors: [{ name: "WAVEO" }],
  openGraph: {
    title: "WAVEO — Previsão de ondas em Portugal",
    description:
      "Condições de surf, hora a hora, para as principais praias de Portugal continental.",
    locale: "pt_PT",
    type: "website",
    siteName: "WAVEO",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#01050d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:border focus:border-tide-400/60 focus:bg-abyss-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-tide-100"
        >
          Saltar para o conteúdo
        </a>

        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
