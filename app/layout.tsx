import type { Metadata } from "next";
import "./globals.css";
import "./actions.css";
import "./creative-selection.css";
import "./generation-progress.css";
export const metadata: Metadata = { title: "eSoukk AI Content Studio", description: "Turn Shopify products into branded social campaigns." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
