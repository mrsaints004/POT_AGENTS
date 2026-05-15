import type { Metadata } from "next";
import Link from "next/link";
import { Web3Provider } from "@/components/Web3Provider";
import { ConnectWallet } from "@/components/ConnectWallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof of Thought — Autonomous Freelancer Agent",
  description: "AI agent with on-chain reasoning attestations on Kite blockchain",
};

function Nav() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 flex items-center h-14 gap-8">
        <Link href="/" className="font-bold text-lg text-kite-400">
          PoT Agent
        </Link>
        <div className="flex gap-6 text-sm">
          <Link href="/" className="text-gray-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/tasks/new" className="text-gray-400 hover:text-white transition">
            New Task
          </Link>
          <Link href="/attestations" className="text-gray-400 hover:text-white transition">
            Attestations
          </Link>
          <Link href="/comparisons" className="text-gray-400 hover:text-white transition">
            Compare
          </Link>
          <Link href="/agent" className="text-gray-400 hover:text-white transition">
            Agent
          </Link>
          <Link href="/status" className="text-gray-400 hover:text-white transition">
            Status
          </Link>
        </div>
        <div className="ml-auto">
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Web3Provider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}
