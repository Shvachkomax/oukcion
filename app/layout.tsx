import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Оукцион - магазин и аукцион публичных персон",
  description:
    "Российская платформа для покупки мерча, автографов, авторских услуг и аукционных лотов публичных персон."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
