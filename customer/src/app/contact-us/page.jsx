import PolicyPageTemplate from '../components/PolicyPageTemplate';
import { SUPPORT_DETAILS } from '@/lib/legal';

export const metadata = {
  title: 'Contact Us | Aurazone',
  description: 'Get in touch with Aurazone customer support for order, shipping, and payment help.',
};

export default function ContactUsPage() {
  return (
    <PolicyPageTemplate
      title="Contact Us"
      description="Our support team is available to help with orders, delivery, returns, and payment-related questions."
    >
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Customer Support</h2>
        <p>
          Email:{' '}
          <a className="font-semibold text-orange-600 hover:text-orange-700" href={`mailto:${SUPPORT_DETAILS.email}`}>
            {SUPPORT_DETAILS.email}
          </a>
        </p>
        <p className="mt-2">
          Phone:{' '}
          <a className="font-semibold text-orange-600 hover:text-orange-700" href={`tel:${SUPPORT_DETAILS.phoneHref}`}>
            {SUPPORT_DETAILS.phoneDisplay}
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Business Address</h2>
        <p>{SUPPORT_DETAILS.address}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Support Hours</h2>
        <p>{SUPPORT_DETAILS.hours}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Services</h2>
        <p>Available In-Store & Online</p>
      </section>
    </PolicyPageTemplate>
  );
}
