import type { Metadata } from 'next'
import { Creepster, Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const creepster = Creepster({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-troll'
})

const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-body'
})

export const metadata: Metadata = {
  title: 'snorg-morgue.org - DCSS Morgue Analytics',
  description: 'Track your Dungeon Crawl Stone Soup gaming stats',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('dcss-theme-style');
                  if (theme === 'ascii') {
                    document.documentElement.classList.add('theme-ascii');
                  } else {
                    document.documentElement.classList.add('theme-tiles');
                  }
                } catch (e) {
                  document.documentElement.classList.add('theme-tiles');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${creepster.variable} ${spaceMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
