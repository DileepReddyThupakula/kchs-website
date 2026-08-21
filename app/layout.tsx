import type { Metadata } from "next";
import "./globals.css";
import "./polish.css";
import "./phase-two.css";
import "./compact-internal-pages.css";

export const metadata: Metadata = {
  title: { default: "Krishna Chaitanya High School | Yerraguntla", template: "%s | KCHS" },
  description: "Krishna Chaitanya High School, Yerraguntla — English Medium State Board education from Nursery to Class 10. Excellence in Education Since 2001.",
  keywords: ["Krishna Chaitanya High School", "Yerraguntla school", "State Board school", "English Medium school", "Vempalli Road"],
  openGraph: { title: "Krishna Chaitanya High School", description: "Learn • Grow • Excel. Excellence in Education Since 2001.", locale: "en_IN", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
