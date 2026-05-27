import Navbar from '@/components/Navbar'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        links={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/requests', label: 'Requests' },
          { href: '/retainer', label: 'Retainer' },
        ]}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
