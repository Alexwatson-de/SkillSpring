import type { Metadata } from "next";
import { Provider } from "@/components/provider";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "SkillSpring — Good things grow together",
    template: "%s | SkillSpring",
  },
  description:
    "Trade what you know for what you’re curious about. Find a skill-sharing partner, exchange knowledge, and grow together.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
