import Link from 'next/link';

interface PublicFooterProps {
  currentPage?: 'home' | 'features' | 'pricing' | 'faq' | 'privacy' | 'terms';
}

export function PublicFooter({ currentPage = 'home' }: PublicFooterProps) {
  const navItems = [
    { href: '/', label: 'Home', key: 'home' },
    { href: '/features', label: 'Features', key: 'features' },
    { href: '/pricing', label: 'Contact', key: 'pricing' },
    { href: '/faq', label: 'FAQ', key: 'faq' },
  ];

  const legalItems = [
    { href: '/privacy', label: 'Privacy Policy', key: 'privacy' },
    { href: '/terms', label: 'Terms of Service', key: 'terms' },
  ];

  return (
    <footer className="relative border-t border-border py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Mobile: Stack vertically, Desktop: Side by side */}
        <div className="flex flex-col gap-6 sm:gap-4 md:flex-row md:items-center md:justify-between">
          {/* Navigation Links */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 text-sm text-muted-foreground">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`transition-colors ${
                  currentPage === item.key
                    ? 'text-primary'
                    : 'hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Legal Links */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 sm:gap-6 text-sm text-muted-foreground">
            {legalItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`transition-colors ${
                  currentPage === item.key
                    ? 'text-primary'
                    : 'hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center text-xs sm:text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} DataFlow AI by{' '}
            <a
              href="https://highguts.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Highguts Solutions LLP
            </a>
            . All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
