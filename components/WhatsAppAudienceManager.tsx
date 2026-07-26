"use client";

import { Mail, MapPin, MessageCircle, Phone, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  phone_e164: string | null;
  email: string | null;
  display_name: string | null;
  country: string | null;
  country_code: string | null;
  marketing_opt_in: boolean;
  opted_out_at: string | null;
  opt_in_source: string | null;
  shopify_customer_id: string | null;
};

async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (response.status >= 500 || text.trimStart().startsWith("An error")) {
      throw new Error("The Shopify synchronization did not finish before the server timeout. Please try again.");
    }
    throw new Error("The server returned an invalid response. Please refresh and try again.");
  }
}

export default function WhatsAppAudienceManager({
  compact = false,
  onCountChange,
}: {
  compact?: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/contacts", { cache: "no-store" });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(String(data.error || "Unable to load the contact library."));
      setContacts((data.contacts as Contact[]) || []);
      onCountChange?.(Number(data.optedIn || 0));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load the contact library.");
    }
  }, [onCountChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function syncShopify() {
    setBusy("sync");
    setMessage("");
    try {
      const response = await fetch("/api/shopify/customers/sync", { method: "POST" });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(String(data.error || "Unable to synchronize Shopify customers."));
      setMessage(String(data.message || "Shopify contacts synchronized."));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to synchronize Shopify customers.");
    } finally {
      setBusy("");
    }
  }

  async function add() {
    setBusy("add");
    setMessage("");
    try {
      const response = await fetch("/api/whatsapp/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, displayName: name, marketingOptInConfirmed: confirmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setName("");
      setPhone("");
      setConfirmed(false);
      setMessage("Offline contact saved with explicit WhatsApp consent.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add contact.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(contact: Contact, enabled: boolean) {
    const label = contact.display_name || contact.phone_e164 || contact.email || "this contact";
    if (
      enabled &&
      !window.confirm(`Confirm that ${label} explicitly agreed to receive WhatsApp marketing messages from eSoukk.`)
    ) return;
    setBusy(contact.id);
    setMessage("");
    try {
      const response = await fetch("/api/whatsapp/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, marketingOptIn: enabled, marketingOptInConfirmed: enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update consent.");
    } finally {
      setBusy("");
    }
  }

  async function remove(contact: Contact) {
    const label = contact.display_name || contact.phone_e164 || contact.email || "this contact";
    if (!window.confirm(`Remove ${label} from the contact library?`)) return;
    setBusy(contact.id);
    try {
      const response = await fetch(`/api/whatsapp/contacts?id=${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove contact.");
    } finally {
      setBusy("");
    }
  }

  const optedIn = contacts.filter((contact) => contact.marketing_opt_in && !contact.opted_out_at).length;
  const emailCount = contacts.filter((contact) => contact.email).length;
  const mobileCount = contacts.filter((contact) => contact.phone_e164).length;
  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [contact.display_name, contact.email, contact.phone_e164, contact.country, contact.country_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [contacts, search]);

  const heading = (
    <div className="whatsapp-audience-heading">
      <div>
        <span>SHOPIFY CONTACT LIBRARY</span>
        <h4><MessageCircle size={17} /> Complete customer address book</h4>
      </div>
      <div className="contact-library-actions">
        <div className="contact-count-pills">
          <strong>{contacts.length} contacts</strong>
          <strong>{emailCount} email</strong>
          <strong>{mobileCount} mobile</strong>
          <strong>{optedIn} WhatsApp eligible</strong>
        </div>
        <button type="button" className="shopify-contact-sync" onClick={syncShopify} disabled={busy === "sync"}>
          <RefreshCw size={14} className={busy === "sync" ? "spin" : ""} />
          {busy === "sync" ? "Synchronizing…" : "Import / sync Shopify"}
        </button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <section className="whatsapp-audience compact">
        {heading}
        <p className="contact-library-note">
          Campaign release targets all {optedIn} eligible contacts with recorded WhatsApp marketing consent.
        </p>
        {message && <p className="whatsapp-audience-message">{message}</p>}
      </section>
    );
  }

  return (
    <section className="whatsapp-audience">
      {heading}
      <p className="contact-library-note">
        Names, country, mobile numbers, email addresses and channel consent synchronize from Shopify.
      </p>

      <details className="contact-address-book">
        <summary>Open address book ({contacts.length} contacts)</summary>
        <div className="contact-address-book-body">
          <label className="contact-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, country, mobile or email"
            />
          </label>

          <details className="manual-contact-entry">
            <summary>Add an offline opt-in manually</summary>
            <div className="whatsapp-contact-form">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contact name" />
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+971501234567" />
              <label>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                I confirm this contact explicitly agreed to receive WhatsApp marketing messages from eSoukk.
              </label>
              <button type="button" onClick={add} disabled={!phone || !confirmed || busy === "add"}>
                <Plus size={17} /> Add opted-in contact
              </button>
            </div>
          </details>

          <div className="whatsapp-contact-list">
            {filteredContacts.map((contact) => (
              <article key={contact.id} className="contact-address-card">
                <div className="contact-address-main">
                  <strong>{contact.display_name || "Unnamed customer"}</strong>
                  <div className="contact-address-fields">
                    <span><MapPin size={14} /> {contact.country || contact.country_code || "Country unavailable"}</span>
                    <span><Phone size={14} /> {contact.phone_e164 || "Mobile unavailable"}</span>
                    <span><Mail size={14} /> {contact.email || "Email unavailable"}</span>
                  </div>
                  <small>{contact.shopify_customer_id ? "Shopify synchronized" : "Manually added"}</small>
                </div>
                <div className="contact-address-actions">
                  <label>
                    <input
                      type="checkbox"
                      checked={contact.marketing_opt_in && !contact.opted_out_at}
                      disabled={busy === contact.id || !contact.phone_e164}
                      onChange={(event) => void toggle(contact, event.target.checked)}
                    />
                    WhatsApp opt-in
                  </label>
                  <button type="button" aria-label="Remove contact" onClick={() => void remove(contact)} disabled={busy === contact.id}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {!filteredContacts.length && <p className="whatsapp-audience-empty">No contacts match your search.</p>}
          </div>
        </div>
      </details>
      {message && <p className="whatsapp-audience-message">{message}</p>}
    </section>
  );
}
