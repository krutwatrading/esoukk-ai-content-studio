"use client";

import { useEffect, useState } from "react";
import type { ProductData } from "@/lib/types";
import { Search, RefreshCw, PackageCheck, Check } from "lucide-react";

type ShopifyProduct = ProductData & {
  adminId: string;
  status: string;
  sku: string;
  inventoryQuantity: number | null;
};

export default function ShopifyProductPicker({
  onSelect, selectedHandle
}: {
  onSelect: (product: ProductData) => void;
  selectedHandle?: string;
}) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<string>("Checking Shopify...");
  const [error, setError] = useState("");

  async function checkConnection() {
    try {
      const response = await fetch("/api/shopify/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConnection(`Connected to ${data.shop.name}`);
    } catch (e) {
      setConnection("Shopify not connected");
      setError(e instanceof Error ? e.message : "Connection failed.");
    }
  }

  async function loadProducts(search = "") {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ first: "24" });
      if (search.trim()) params.set("q", `title:*${search.trim()}* OR sku:*${search.trim()}*`);
      const response = await fetch(`/api/shopify/products?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProducts(data.products || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const startup = window.setTimeout(() => {
      void checkConnection();
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(startup);
  }, []);

  return (
    <section className="panel shopify-picker">
      <div className="picker-heading">
        <div>
          <div className="eyebrow">SHOPIFY ADMIN API</div>
          <h2>Your live product catalogue</h2>
          <p className="connection"><PackageCheck size={15}/> {connection}</p>
        </div>
        <button className="icon-action" onClick={() => loadProducts(query)} disabled={loading}>
          <RefreshCw size={17}/> Refresh
        </button>
      </div>

      <form className="product-search" onSubmit={(e) => { e.preventDefault(); loadProducts(query); }}>
        <Search size={18}/>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product title or SKU"
        />
        <button type="submit">Search</button>
      </form>

      {error && <div className="status error">{error}</div>}
      {loading && <div className="empty small">Loading products from Shopify…</div>}

      {!loading && (
        <div className="shopify-grid">
          {products.map((product) => (
            <article className={`shopify-product ${selectedHandle === product.handle ? "selected" : ""}`} key={product.adminId}>
              <div className="product-image-wrap">
                {product.images[0] ? <img src={product.images[0]} alt={product.title}/> : <div className="no-image">No image</div>}
                <span className={`product-status ${product.status.toLowerCase()}`}>{product.status}</span>
              </div>
              <div className="shopify-product-body">
                <h3>{product.title}</h3>
                <p>{product.currency} {product.price.toFixed(2)}</p>
                <small>{product.sku ? `SKU: ${product.sku}` : product.productType || "Product"}</small>
                <button type="button" className={selectedHandle === product.handle ? "selected-product-button" : ""} onClick={() => onSelect(product)} aria-pressed={selectedHandle === product.handle}>
                  {selectedHandle === product.handle ? <><Check size={16}/> Selected</> : "Use this product"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
