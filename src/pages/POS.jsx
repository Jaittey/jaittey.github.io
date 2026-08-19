import { useMemo, useState } from 'react';
import { supabase } from '../config/supabase';
import { requireActiveBusinessId } from '../services/tenantContext';
import { currency, safeNumber } from '../utils/format';

const paymentMethods = ['Cash', 'Bank Transfer', 'Card', 'Other'];

export default function POS({ products = [], customers = [], invoices = [], settings = {}, notify }) {
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(Number(settings.gstPercent || 0));
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!q) return true;
      return `${product.name || ''} ${product.sku || ''}`.toLowerCase().includes(q);
    });
  }, [products, search]);

  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const totals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) => sum + safeNumber(item.price) * safeNumber(item.qty),
      0,
    );
    const discount = subtotal * safeNumber(discountPercent) / 100;
    const taxable = Math.max(0, subtotal - discount);
    const gst = taxable * safeNumber(gstPercent) / 100;
    return { subtotal, discount, gst, total: taxable + gst };
  }, [cart, discountPercent, gstPercent]);

  const addProduct = (product) => {
    const stock = safeNumber(product.quantity);
    if (stock <= 0) {
      notify('This product is out of stock.', 'error');
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        if (existing.qty >= stock) {
          notify('Not enough stock available.', 'error');
          return current;
        }
        return current.map((item) => (
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        ));
      }
      return [...current, { ...product, qty: 1 }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart((current) => current
      .map((item) => {
        if (item.id !== productId) return item;
        const nextQty = Math.max(0, Math.min(safeNumber(item.quantity), item.qty + delta));
        return { ...item, qty: nextQty };
      })
      .filter((item) => item.qty > 0));
  };

  const completeSale = async () => {
    if (!cart.length || totals.total <= 0) return;
    setBusy(true);

    try {
      const date = new Date().toISOString().slice(0, 10);
      const invoiceNumber = `POS-${date.replaceAll('-', '')}-${String(Date.now()).slice(-6)}`;
      const invoice = {
        invoiceNumber,
        source: 'POS',
        status: 'PAID',
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer?.name || selectedCustomer?.customerName || 'Walk-in Customer',
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.qty,
          unitPrice: safeNumber(item.price),
          amount: safeNumber(item.price) * item.qty,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        gst: totals.gst,
        total: totals.total,
        paymentMethod,
        date,
      };

      const { error } = await supabase.rpc('sb_complete_pos_sale', {
        p_business_id: requireActiveBusinessId(),
        p_invoice: invoice,
        p_payment: {
          amount: totals.total,
          paymentMethod,
          paymentDate: date,
          status: 'PAID',
        },
      });

      if (error) throw error;

      setCart([]);
      setCustomerId('');
      setDiscountPercent(0);
      notify(`Sale ${invoiceNumber} completed.`);
    } catch (reason) {
      notify(reason?.message || 'Could not complete POS sale.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const recentSales = invoices
    .filter((invoice) => invoice.source === 'POS')
    .slice(0, 8);

  return (
    <div className="pos-page">
      <section className="pos-hero panel">
        <div>
          <p className="eyebrow">SALES & BILLING</p>
          <h2>Point of Sale</h2>
          <p>Fast counter sales with automatic stock deduction, paid invoice creation and payment recording.</p>
        </div>
        <div className="pos-total-card">
          <small>Current sale</small>
          <strong>{currency(totals.total, settings.currency)}</strong>
          <span>{cart.reduce((sum, item) => sum + item.qty, 0)} item(s)</span>
        </div>
      </section>

      <div className="pos-layout">
        <section className="panel pos-products-panel">
          <div className="pos-toolbar">
            <div className="search-box">⌕
              <input
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Walk-in Customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name || customer.customerName || 'Customer'}
                </option>
              ))}
            </select>
          </div>

          <div className="pos-product-grid">
            {filteredProducts.map((product) => (
              <button
                type="button"
                className="pos-product-card"
                key={product.id}
                disabled={safeNumber(product.quantity) <= 0}
                onClick={() => addProduct(product)}
              >
                <span>{(product.name || 'P').slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{product.name || 'Product'}</strong>
                  <small>{product.sku || 'No SKU'}</small>
                </div>
                <b>{currency(product.price, settings.currency)}</b>
                <small>{safeNumber(product.quantity)} in stock</small>
              </button>
            ))}
            {!filteredProducts.length && <div className="empty-backup-state">No products found.</div>}
          </div>
        </section>

        <section className="panel pos-cart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CART</p>
              <h2>Current sale</h2>
            </div>
          </div>

          <div className="pos-cart-list">
            {cart.map((item) => (
              <div className="pos-cart-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{currency(item.price, settings.currency)} each</small>
                </div>
                <div className="pos-qty">
                  <button type="button" onClick={() => changeQty(item.id, -1)}>−</button>
                  <b>{item.qty}</b>
                  <button type="button" onClick={() => changeQty(item.id, 1)}>+</button>
                </div>
                <strong>{currency(safeNumber(item.price) * item.qty, settings.currency)}</strong>
              </div>
            ))}
            {!cart.length && <div className="empty-backup-state">Add an inventory item to begin.</div>}
          </div>

          <div className="form-grid pos-adjustments">
            <label>
              <span>Discount %</span>
              <input type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
            </label>
            <label>
              <span>GST %</span>
              <input type="number" min="0" max="100" step="0.01" value={gstPercent} onChange={(event) => setGstPercent(event.target.value)} />
            </label>
            <label className="form-span-2">
              <span>Payment method</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
          </div>

          <div className="pos-totals">
            <div><span>Subtotal</span><strong>{currency(totals.subtotal, settings.currency)}</strong></div>
            <div><span>Discount</span><strong>− {currency(totals.discount, settings.currency)}</strong></div>
            <div><span>GST</span><strong>{currency(totals.gst, settings.currency)}</strong></div>
            <div className="pos-grand-total"><span>Total</span><strong>{currency(totals.total, settings.currency)}</strong></div>
          </div>

          <button className="button button-primary pos-checkout" disabled={!cart.length || busy} onClick={completeSale}>
            {busy ? 'Completing sale…' : `Complete Sale · ${currency(totals.total, settings.currency)}`}
          </button>
        </section>
      </div>

      <section className="panel pos-recent-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">RECENT POS SALES</p>
            <h2>Latest counter transactions</h2>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead><tr><th>Sale</th><th>Customer</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {recentSales.map((invoice) => (
                <tr key={invoice.id}>
                  <td data-label="Sale">{invoice.invoiceNumber || invoice.id}</td>
                  <td data-label="Customer">{invoice.customerName || 'Walk-in Customer'}</td>
                  <td data-label="Payment">{invoice.paymentMethod || '—'}</td>
                  <td data-label="Status"><span className="status status-paid">PAID</span></td>
                  <td data-label="Total">{currency(invoice.total, settings.currency)}</td>
                </tr>
              ))}
              {!recentSales.length && <tr><td colSpan="5">No POS sales yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
