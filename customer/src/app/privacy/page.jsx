import Link from 'next/link';
import PolicyPageTemplate from '../components/PolicyPageTemplate';
import { SUPPORT_DETAILS } from '@/lib/legal';

export const metadata = {
  title: 'Privacy Policy | Aurazone',
  description: 'Understand what data Aurazone collects, how it is used, and your privacy rights.',
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPageTemplate
      title="Privacy Policy"
      description="This policy describes what information we collect, how we use it, and the controls available to you."
    >
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">1. Information We Collect</h2>
        <p>
          We collect information you provide directly, such as name, phone number, email address, shipping address,
          and order details. We may also collect device, usage, and log information for security and analytics.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">2. How We Use Information</h2>
        <p>
          Your information is used to process orders, provide customer support, communicate updates, improve user
          experience, and comply with legal or regulatory obligations.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">3. Payment and Data Sharing</h2>
        <p>
          Payment processing is handled by secure third-party gateways. We share only necessary information with
          logistics, payment, and technology partners to complete your order and operate the platform.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">4. Data Security</h2>
        <p>
          We implement reasonable technical and organizational safeguards to protect personal information. However, no
          online system can guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">5. Your Choices</h2>
        <p>
          You can request updates or corrections to your profile information and reach out for account support at{' '}
          <a className="font-semibold text-orange-600 hover:text-orange-700" href={`mailto:${SUPPORT_DETAILS.email}`}>
            {SUPPORT_DETAILS.email}
          </a>
          . You can also review our{' '}
          <Link href="/terms-and-conditions" className="font-semibold text-orange-600 hover:text-orange-700">
            Terms and Conditions
          </Link>
          .
        </p>
      </section>
    </PolicyPageTemplate>
  );
}
