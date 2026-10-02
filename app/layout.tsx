import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mentira Profissional — Party Game",
  description: "Descubra quem está falando a verdade.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
