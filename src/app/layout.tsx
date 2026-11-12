import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GilBot - Niv Gilboa Restaurant Review Chatbot",
  description:
    "AI chatbot powered by RAG over Niv Gilboa's YouTube restaurant reviews",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
