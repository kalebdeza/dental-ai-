import "./globals.css";
import Sidebar from "./components/Sidebar";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Dental Revenue AI",
  description: "AI-powered dental revenue recovery platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body
        style={{
          margin: 0,
          background: "#f1f5f9",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div className="flex min-h-screen">

          <Sidebar />

          <main className="flex-1 overflow-y-auto p-10">

            <div className="mx-auto max-w-[1600px]">
              
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}