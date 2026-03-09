import Link from 'next/link';
import PolicyPageTemplate from '../components/PolicyPageTemplate';
import { SUPPORT_DETAILS } from '@/lib/legal';

export const metadata = {
  title: 'Cancellations and Refunds | Aurazone',
  description: 'Learn about order cancellations, returns, and refund timelines for Aurazone purchases.',
};

export default function CancellationsAndRefundsPage() {
  return (
    <PolicyPageTemplate
      title="Cancellations and Refunds"
      description="This policy explains how cancellations, return approvals, and refund settlements are handled for purchases made on Aurazone."
    >
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">1. Order Cancellation</h2>
        <p>
          Orders can be cancelled before they are shipped. Once your order is marked as dispatched, cancellation
          is no longer possible. To request cancellation, contact our support team immediately with your order ID.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">2. Return Eligibility</h2>
        <p>
          Returns are accepted for wrong, damaged, or defective items, and for size issues based on stock
          availability. Return requests should be raised within 7 days of delivery. Products must be unused, in
          original packaging, and with all tags intact.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">3. Refund Timeline</h2>
        <p>
          Approved refunds are processed to the original payment source within 5 to 7 business days. For Cash on
          Delivery orders, refunds may be completed through bank transfer after bank details are confirmed.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">4. Non-Refundable Charges</h2>
        <p>
          Shipping and convenience charges may not be refunded unless the return is due to an error on our side,
          such as incorrect or damaged delivery.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">5. Support</h2>
        <p>
          For cancellation, return, or refund assistance, write to{' '}
          <a className="font-semibold text-orange-600 hover:text-orange-700" href={`mailto:${SUPPORT_DETAILS.email}`}>
            {SUPPORT_DETAILS.email}
          </a>{' '}
          or visit our{' '}
          <Link href="/contact-us" className="font-semibold text-orange-600 hover:text-orange-700">
            Contact Us
          </Link>{' '}
          page.
        </p>
      </section>
    </PolicyPageTemplate>
  );
}
