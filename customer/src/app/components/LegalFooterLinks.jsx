import Link from 'next/link';
import { LEGAL_LINKS } from '@/lib/legal';

export default function LegalFooterLinks({ className = '', linkClassName = '' }) {
  return (
    <div className={className}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Legal & Support</h2>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium text-slate-700 hover:text-orange-600 transition-colors ${linkClassName}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
