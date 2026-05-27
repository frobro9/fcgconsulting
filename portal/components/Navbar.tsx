'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavLink {
  href: string
  label: string
}

interface NavbarProps {
  links: NavLink[]
  adminMode?: boolean
}

export default function Navbar({ links, adminMode = false }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-primary border-b border-blue-900 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo-white.svg" alt="Capital Consulting" className="h-7 w-auto" />
            {adminMode && (
              <span className="bg-accent text-primary text-xs font-bold px-1.5 py-0.5 rounded">
                ADMIN
              </span>
            )}
          </div>

          {/* Desktop Links */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="ml-4 px-4 py-2 rounded-lg text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10 transition"
            >
              Sign Out
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {menuOpen && (
          <div className="sm:hidden pb-3 space-y-1 border-t border-blue-900 pt-3">
            {links.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10 transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
