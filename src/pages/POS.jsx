import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import { completePosSale } from '../services/database';
import { calculateDocumentTotals, currency, makeNumber, safeNumber } from '../utils/format';

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Other'];

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export default function POS({ products, customers, invoices, settings, notify }) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [discountRate, setDiscountRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountTendered, setAmountTendered] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  const availableProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [product.name, product.sku, product.id].some((value) => String(value || '').toLowerCase().includes(term));
  }), [products, search]);

  const customer = customers.find((item) => item.id === customerId) || null;
  const gstRate = settings.gstRegistered ? safeNumber(settings.defaultGstRate) : 0;
  const totals = useMemo(() => calculateDocumentTotals(cart, discountRate, gstRate), [cart, discountRate, gstRate]);
  const tendered = safeNumber(amountTendered);
  const changeDue = paymentMethod === 'Cash' ? Math.max(0, tendered - totals.total) : 0;

  const recentSales = useMemo(() => invoices
    .filter((item) => String(item.source || '').toUpperCase() === 'POS')
    .slice(0, 8), [invoices]);

  const addProduct = (product) => {
    const stock = Math.max(0, safeNumber(product.quantity));
    if (stock <= 0) return notify(`${product.name} is out of stock.`, 'error');
    setCart((current) => {
      const found = current.find((item) => item.productId === product.id);
      if (found) {
        if (safeNumber(found.quantity) >= stock) {
          notify(`Only ${stock} ${product.name} available.`, 'error');
          return current;
        }
        return current.map((item) => item.productId === product.id ? { ...item, quantity: safeNumber(item.quantity) + 1 } : item);
      }
      return [...current, {
        productId: product.id,
        sku: product.sku || '',
        description: product.name,
        name: product.name,
        quantity: 1,
        price: safeNumber(product.price),
        stock,
      }];
    });
  };

  const setQuantity = (productId, value) => {
    setCart((current) => current.flatMap((item) => {
      if (item.productId !== productId) return [item];
      const quantity = Math.max(0, Math.min(safeNumber(item.stock), Math.floor(safeNumber(value))));
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const onSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    const term = search.trim().toLowerCase();
    if (!term) return;
    const exact = products.find((item) => String(item.sku || '').toLowerCase() === term)
      || products.find((item) => String(item.name || '').toLowerCase() === term)
      || availableProducts[0];
    if (exact) {
      addProduct(exact);
      setSearch('');
    }
  };

  const resetSale = () => {
    setCart([]);
    setCustomerId('');
    setDiscountRate(0);
    setPaymentMethod('Cash');
    setPaymentReference('');
    setAmountTendered('');
  };

  const printReceipt = (sale = lastSale) => {
    if (!sale) return;
    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) return notify('Allow pop-ups to print the POS receipt.', 'error');
    const rows = sale.items.map((item) => `<tr><td>${escapeHtml(item.description || item.name)}</td><td>${safeNumber(item.quantity)}</td><td>${escapeHtml(currency(safeNumber(item.quantity) * safeNumber(item.price), settings.currency))}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(sale.invoiceNumber)}</title><style>body{font-family:Arial,sans-serif;padding:22px;color:#111}h1{font-size:20px;margin:0}.muted{color:#666;font-size:12px}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:7px 0;border-bottom:1px dashed #bbb;text-align:left;font-size:12px}td:last-child,th:last-child{text-align:right}.total{font-size:18px;font-weight:700;display:flex;justify-content:space-between;margin-top:12px}.center{text-align:center;margin-top:24px}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(settings.businessName || 'Small Business')}</h1><div class="muted">POS Receipt · ${escapeHtml(sale.invoiceNumber)}</div><div class="muted">${escapeHtml(new Date(sale.createdAt || Date.now()).toLocaleString('en-GB'))}</div><div class="muted">Customer: ${escapeHtml(sale.customerName || 'Walk-in Customer')}</div><table><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="muted">Subtotal: ${escapeHtml(currency(sale.subtotal, settings.currency))}</div><div class="muted">Discount: ${escapeHtml(currency(sale.discountAmount, settings.currency))}</div><div class="muted">GST: ${escapeHtml(currency(sale.gstAmount, settings.currency))}</div><div class="total"><span>TOTAL</span><span>${escapeHtml(currency(sale.total, settings.currency))}</span></div><div class="muted">Payment: ${escapeHtml(sale.paymentMethod)}</div>${sale.changeDue > 0 ? `<div class="muted">Change: ${escapeHtml(currency(sale.changeDue, settings.currency))}</div>` : ''}<p class="center">Thank you for your business.</p><button onclick="window.print()">Print</button></body></html>`);
    popup.document.close();
    popup.focus();
  };

  const complete = async () => {
    if (!cart.length) return notify('Add at least one product to the cart.', 'error');
    if (totals.total <= 0) return notify('Sale total must be greater than zero.', 'error');
    if (paymentMethod === 'Cash' && tendered < totals.total) return notify('Cash received is less than the sale total.', 'error');

    const now = new Date();
    const invoiceNumber = makeNumber('POS');
    const sale = {
      invoiceNumber,
      source: 'POS',
      documentType: 'POS SALE',
      documentDate: now.toISOString().slice(0, 10),
      customerId: customer?.id || '',
      customerName: customer?.name || customer?.customerName || 'Walk-in Customer',
      customerOrganisation: customer?.organisation || customer?.company || '',
      items: cart.map(({ stock, ...item }) => ({ ...item, quantity: safeNumber(item.quantity), price: safeNumber(item.price) })),
      subtotal: totals.subtotal,
      discountRate: totals.discountRate,
      discountAmount: totals.discountAmount,
      taxableAmount: totals.taxableAmount,
      gstRate: totals.gstRate,
      gstAmount: totals.gstAmount,
      total: totals.total,
      amountPaid: totals.total,
      balanceDue: 0,
      status: 'PAID',
      paymentMethod,
      paymentReference: paymentReference.trim(),
      notes: 'Created from POS System',
    };
    const payment = {
      amount: totals.total,
      method: paymentMethod,
      paymentMethod,
      reference: paymentReference.trim(),
      paymentReference: paymentReference.trim(),
      paymentDate: now.toISOString().slice(0, 10),
      source: 'POS',
      notes: paymentMethod === 'Cash' ? `Tendered ${tendered.toFixed(2)}; change ${changeDue.toFixed(2)}` : 'POS payment',
    };

    setProcessing(true);
    try {
      const result = await completePosSale(sale, payment);
      const completed = { ...sale, id: result.invoiceId, paymentId: result.paymentId, createdAt: now.toISOString(), amountTendered: tendered, changeDue };
      setLastSale(completed);
      resetSale();
      notify(`Sale ${invoiceNumber} completed successfully.`);
    } catch (reason) {
      notify(reason?.message || 'Could not complete POS sale.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return <div className="pos-page">
    <section className="pos-hero">
      <div><p className="eyebrow">SALES & POS</p><h2>Point of Sale</h2><p>Fast checkout with live inventory deduction and paid invoice creation.</p></div>
      <div className="pos-hero-total"><small>Current sale</small><strong>{currency(totals.total, settings.currency)}</strong><span>{cart.reduce((sum, item) => sum + safeNumber(item.quantity), 0)} item(s)</span></div>
    </section>

    <div className="pos-layout">
      <section className="panel pos-products-panel">
        <div className="panel-heading pos-panel-heading"><div><p className="eyebrow">PRODUCTS</p><h2>Select items</h2></div><div className="pos-search search-box">⌕<input autoFocus placeholder="Search name or scan SKU" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKeyDown}/></div></div>
        <div className="pos-product-grid">
          {availableProducts.map((product) => {
            const stock = safeNumber(product.quantity);
            return <button type="button" className={`pos-product-card ${stock <= 0 ? 'out' : ''}`} key={product.id} onClick={() => addProduct(product)} disabled={stock <= 0}>
              <span className="pos-product-icon">{String(product.name || 'P').slice(0, 2).toUpperCase()}</span>
              <strong>{product.name}</strong>
              <small>{product.sku ? `SKU ${product.sku}` : 'No SKU'}</small>
              <b>{currency(product.price, settings.currency)}</b>
              <i>{stock > 0 ? `${stock} in stock` : 'Out of stock'}</i>
            </button>;
          })}
        </div>
        {!availableProducts.length && <EmptyState icon="⌕" title="No products found" text="Try another search or add products in Inventory." />}
      </section>

      <aside className="panel pos-cart-panel">
        <div className="panel-heading"><div><p className="eyebrow">CHECKOUT</p><h2>Cart</h2></div>{cart.length > 0 && <button className="panel-link-button" type="button" onClick={() => setCart([])}>Clear</button>}</div>
        <div className="pos-cart-items">
          {cart.map((item) => <article className="pos-cart-row" key={item.productId}>
            <div><strong>{item.description}</strong><small>{currency(item.price, settings.currency)} each</small></div>
            <div className="pos-qty"><button type="button" onClick={() => setQuantity(item.productId, safeNumber(item.quantity) - 1)}>−</button><input type="number" min="1" max={item.stock} value={item.quantity} onChange={(e) => setQuantity(item.productId, e.target.value)}/><button type="button" onClick={() => setQuantity(item.productId, safeNumber(item.quantity) + 1)}>＋</button></div>
            <b>{currency(safeNumber(item.quantity) * safeNumber(item.price), settings.currency)}</b>
          </article>)}
          {!cart.length && <div className="pos-empty-cart"><span>▤</span><strong>Cart is empty</strong><small>Select a product to start a sale.</small></div>}
        </div>

        <div className="pos-checkout-fields">
          <label><span>Customer</span><select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in Customer</option>{customers.map((item) => <option value={item.id} key={item.id}>{item.organisation || item.name || item.customerName || 'Customer'}</option>)}</select></label>
          <label><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)}/></label>
          <label><span>Payment method</span><select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setAmountTendered(''); }}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
          {paymentMethod === 'Cash' ? <label><span>Cash received</span><input type="number" min="0" step="0.01" placeholder={totals.total.toFixed(2)} value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)}/></label> : <label><span>Reference (optional)</span><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Transaction / card reference"/></label>}
        </div>

        <div className="pos-totals">
          <div><span>Subtotal</span><b>{currency(totals.subtotal, settings.currency)}</b></div>
          <div><span>Discount</span><b>− {currency(totals.discountAmount, settings.currency)}</b></div>
          <div><span>GST ({totals.gstRate.toFixed(2)}%)</span><b>{currency(totals.gstAmount, settings.currency)}</b></div>
          <div className="pos-grand-total"><span>Total</span><strong>{currency(totals.total, settings.currency)}</strong></div>
          {paymentMethod === 'Cash' && tendered > 0 && <div className="pos-change"><span>Change</span><strong>{currency(changeDue, settings.currency)}</strong></div>}
        </div>
        <button className="button button-primary pos-complete-button" type="button" onClick={complete} disabled={!cart.length || processing}>{processing ? 'Processing sale…' : `Complete Sale · ${currency(totals.total, settings.currency)}`}</button>
      </aside>
    </div>

    <section className="panel pos-recent-panel">
      <div className="panel-heading"><div><p className="eyebrow">RECENT POS SALES</p><h2>Latest checkouts</h2></div>{lastSale && <button className="button button-secondary" type="button" onClick={() => printReceipt(lastSale)}>Print last receipt</button>}</div>
      {lastSale && <div className="pos-success-banner"><span>✓</span><div><strong>{lastSale.invoiceNumber} completed</strong><small>{currency(lastSale.total, settings.currency)} · {lastSale.paymentMethod}{lastSale.changeDue > 0 ? ` · Change ${currency(lastSale.changeDue, settings.currency)}` : ''}</small></div><button type="button" onClick={() => printReceipt(lastSale)}>Receipt</button></div>}
      <div className="responsive-table"><table><thead><tr><th>Sale</th><th>Customer</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead><tbody>{recentSales.map((sale) => <tr key={sale.id}><td data-label="Sale"><strong>{sale.invoiceNumber}</strong></td><td data-label="Customer">{sale.customerOrganisation || sale.customerName || 'Walk-in Customer'}</td><td data-label="Payment">{sale.paymentMethod || '—'}</td><td data-label="Status"><span className="status status-paid">PAID</span></td><td data-label="Total">{currency(sale.total, settings.currency)}</td></tr>)}</tbody></table></div>
      {!recentSales.length && <p className="table-empty">No POS sales yet.</p>}
    </section>
  </div>;
}
