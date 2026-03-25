import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kanban Board',
  description: 'リアルタイム共同編集カンバンボード',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
