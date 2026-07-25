"use client";

import WhatsAppAudienceManager from "./WhatsAppAudienceManager";

export default function ShopifyContactLibrary() {
  return <section className="panel shopify-contact-library" id="shopify-contact-library">
    <div className="eyebrow">PHASE 2 · SHOPIFY CUSTOMER SYNC</div>
    <h2>Customer contact library</h2>
    <p>Mobile numbers, email addresses and channel consent synchronize from Shopify into the eSoukk AI workspace.</p>
    <WhatsAppAudienceManager/>
  </section>;
}
