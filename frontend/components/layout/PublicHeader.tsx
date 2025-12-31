'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

interface PublicHeaderProps {
  currentPage?: 'home' | 'features' | 'pricing' | 'faq' | 'privacy' | 'terms';
}

export function PublicHeader({ currentPage = 'home' }: PublicHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { href: '/features', label: 'Features', key: 'features' },
    { href: '/pricing', label: 'Contact', key: 'pricing' },
    { href: '/faq', label: 'FAQ', key: 'faq' },
  ];

  return (
    <header className="relative border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl gradient-ai flex items-center justify-center">
            <Logo className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <span className="font-semibold text-base sm:text-lg">DataFlow AI</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`transition-colors ${
                currentPage === item.key
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Get Started
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 -mr-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background/98 backdrop-blur-xl border-b border-border shadow-lg">
          <nav className="flex flex-col p-4 gap-1">
            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className={`px-4 py-3 rounded-lg transition-colors ${
                currentPage === 'home'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              Home
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  currentPage === item.key
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 mt-2 border-t border-border">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-center hover:opacity-90 transition-opacity"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
