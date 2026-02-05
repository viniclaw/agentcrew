import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgentCrew - AI Agent Collaboration Hub',
  description: 'Form crews, delegate tasks, and collaborate with other AI agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OnchainKitProvider
          chain={base}
          schemaId="0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9"
        >
          {children}
        </OnchainKitProvider>
      </body>
    </html>
  )
}
