import PolicyPageTemplate from '../components/PolicyPageTemplate';

export const metadata = {
  title: 'Terms and Conditions | Aurazone',
  description: 'Read the terms and conditions governing purchases and use of Aurazone services.',
};

export default function TermsAndConditionsPage() {
  return (
    <PolicyPageTemplate
      title="Terms and Conditions"
      description="These terms govern your access to and use of the Aurazone website, services, and products."
    >
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">1. Acceptance of Terms</h2>
        <p>
          By using this website and placing orders, you agree to these Terms and Conditions, along with our related
          policies including Privacy, Shipping, and Cancellations and Refunds.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">2. Account Responsibility</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account details and for all activity under
          your account. Aurazone reserves the right to suspend accounts involved in misuse or fraudulent activity.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">3. Product and Pricing Information</h2>
        <p>
          We strive for accurate descriptions and pricing, but errors may occur. Aurazone may update product details,
          availability, and pricing without prior notice, and may cancel orders affected by pricing or listing errors.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">4. Payments</h2>
        <p>
          Payments are processed through trusted third-party gateways including Razorpay. Aurazone does not store
          full card credentials on its servers. Orders are confirmed only after successful payment authorization.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">5. Liability and Disputes</h2>
        <p>
          Aurazone is not liable for indirect, incidental, or consequential damages arising from product use or
          service interruptions. Any disputes will be governed by applicable laws of India and subject to local
          jurisdiction.
        </p>
      </section>
    </PolicyPageTemplate>
  );
}
