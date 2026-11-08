import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Game Room',
  description: 'Echtzeit-Multiplayer-Spiele - Spiele Tic Tac Toe, Vier Gewinnt und Schiffe Versenken mit Freunden',
  generator: 'v0.app',
  icons: {
    icon: '/pigeon.png',
    apple: '/pigeon.png',
  },
  openGraph: {
    title: 'Game Room',
    description: 'Echtzeit-Multiplayer-Spiele - Spiele Tic Tac Toe, Vier Gewinnt und Schiffe Versenken mit Freunden',
    images: ['/pigeon.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Game Room',
    description: 'Echtzeit-Multiplayer-Spiele - Spiele Tic Tac Toe, Vier Gewinnt und Schiffe Versenken mit Freunden',
    images: ['/pigeon.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
