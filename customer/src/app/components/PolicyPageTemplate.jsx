import Header from './Header';
import LegalFooterLinks from './LegalFooterLinks';
import { SUPPORT_DETAILS } from '@/lib/legal';

export default function PolicyPageTemplate({ title, description, children }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
          <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">
            Last updated: {SUPPORT_DETAILS.lastUpdated}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2">{title}</h1>
          <p className="text-slate-600 mt-3">{description}</p>

          <div className="mt-8 space-y-6 text-slate-700 leading-relaxed">{children}</div>
        </article>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6">
          <LegalFooterLinks />
        </div>
      </main>
    </div>
  );
}
