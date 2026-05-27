import Navbar from '@/components/Navbar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        links={[
          { href: '/admin', label: 'Admin Queue' },
          { href: '/admin/clients', label: 'Clients' },
          { href: '/admin/audits', label: 'Web Audits' },
        ]}
        adminMode
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
