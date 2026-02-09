import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "🕶️ Mr. Anderson's Mission Control",
  description: 'Private AI Agent Command Center - Assign tasks and watch your agent squad execute in real-time',
  keywords: ['AI', 'agents', 'automation', 'task management'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-[#0a0a0f] text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
