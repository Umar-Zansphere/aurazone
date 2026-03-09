import PolicyPageTemplate from '../components/PolicyPageTemplate';

export const metadata = {
  title: 'Shipping Policy | Aurazone',
  description: 'View shipping coverage, timelines, charges, and delivery handling details for Aurazone orders.',
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPageTemplate
      title="Shipping Policy"
      description="This page explains where we ship, how long deliveries usually take, and how shipping charges are applied."
    >
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">1. Serviceable Locations</h2>
        <p>
          Aurazone currently ships across most pin codes in India. Availability may vary by courier partner coverage
          and operational constraints in specific regions.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">2. Processing and Dispatch</h2>
        <p>
          Confirmed orders are usually processed within 1 to 2 business days. Dispatch updates are shared via order
          status tracking once your shipment is handed to the delivery partner.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">3. Delivery Timelines</h2>
        <p>
          Delivery generally takes 3 to 7 business days after dispatch depending on destination. During high-demand
          periods, weather disruptions, or public holidays, delivery may take longer.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">4. Shipping Charges</h2>
        <p>
          Shipping fees are shown at checkout before payment. Charges may vary based on order value, promotional
          offers, and destination zone.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-2">5. Failed or Delayed Delivery</h2>
        <p>
          If delivery attempts fail due to incorrect address or repeated unavailability, the shipment may be returned
          to origin. Our support team will help with re-delivery options wherever possible.
        </p>
      </section>
    </PolicyPageTemplate>
  );
}
