import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';
import { adjustStockV5 } from '../services/commerce';
import { currency, safeNumber } from '../utils/format';

const blank = {
  name: '', sku: '', barcode: '', category: '', itemType: 'goods', unit: 'pcs',
  location: 'Main Location', supplierId: '', cost: 0, price: 0,
  wholesalePrice: 0, minWholesaleQty: 1, quantity: 0, threshold: 5,
  trackStock: true, notes: '',
};

const ITEM_TYPES = [
  ['goods', 'Retail / wholesale good'],
  ['part', 'Garage / spare part'],
  ['ingredient', 'Restaurant ingredient'],
  ['service', 'Service / labour'],
];

export default function Products({
  products = [], suppliers = [], stockMovements = [], settings = {}, notify = () => {},
}) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ delta: 0, reason: 'Stock count correction', note: '' });

  const categories = useMemo(() => [...new Set(products.map((row) => row.category).filter(Boolean))].sort(), [products]);
  const filtered = useMemo(() => products.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${row.name || ''} ${row.sku || ''} ${row.barcode || ''} ${row.category || ''}`.toLowerCase().includes(q);
    const matchesCategory = category === 'ALL' || row.category === category;
    const low = safeNumber(row.quantity) <= safeNumber(row.threshold ?? 5);
    const matchesStock = stockFilter === 'ALL' || (stockFilter === 'LOW' && low) || (stockFilter === 'OUT' && safeNumber(row.quantity) <= 0);
    return matchesSearch && matchesCategory && matchesStock;
  }), [products, search, category, stockFilter]);

  const metrics = useMemo(() => ({
    items: products.length,
    units: products.reduce((sum, row) => sum + (row.trackStock === false ? 0 : safeNumber(row.quantity)), 0),
    value: products.reduce((sum, row) => sum + (row.trackStock === false ? 0 : safeNumber(row.quantity) * safeNumber(row.cost)), 0),
    low: products.filter((row) => row.trackStock !== false && safeNumber(row.quantity) <= safeNumber(row.threshold ?? 5)).length,
  }), [products]);

  const open = (record = null) => {
    setEditing(record || {});
    setForm({ ...blank, ...(record || {}) });
  };

  const save = async () => {
    if (!form.name.trim()) return notify('Product name is required.', 'error');
    const payload = {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category: form.category.trim(),
      location: form.location.trim() || 'Main Location',
      notes: form.notes.trim(),
      cost: safeNumber(form.cost),
      price: safeNumber(form.price),
      wholesalePrice: safeNumber(form.wholesalePrice),
      minWholesaleQty: Math.max(1, safeNumber(form.minWholesaleQty)),
      quantity: form.trackStock === false ? 0 : safeNumber(form.quantity),
      threshold: Math.max(0, safeNumber(form.threshold)),
      trackStock: Boolean(form.trackStock),
    };
    await saveRecord('products', payload, editing?.id || null);
    setEditing(null);
    notify('Inventory item saved.');
  };

  const adjust = async () => {
    const delta = safeNumber(adjustForm.delta);
    if (!delta) return notify('Enter a stock change.', 'error');
    try {
      await adjustStockV5(adjusting.id, delta, adjustForm.reason, adjustForm.note);
      notify(`Stock updated for ${adjusting.name}.`);
      setAdjusting(null);
      setAdjustForm({ delta: 0, reason: 'Stock count correction', note: '' });
    } catch (error) {
      notify(error.message || 'Could not adjust stock.', 'error');
    }
  };

  return <div className="v5-page">
    <section className="v5-hero panel">
      <div><p className="eyebrow">INVENTORY CONTROL</p><h2>Goods, parts & ingredients</h2><p>Track sellable goods, restaurant ingredients, garage parts and non-stock services from one catalogue.</p></div>
      <button className="button button-primary" onClick={() => open()}>＋ Add inventory item</button>
    </section>

    <section className="v5-kpi-grid">
      <article className="panel"><span>Catalogue</span><strong>{metrics.items}</strong><small>items and services</small></article>
      <article className="panel"><span>Units on hand</span><strong>{metrics.units}</strong><small>tracked stock units</small></article>
      <article className="panel"><span>Stock cost value</span><strong>{currency(metrics.value, settings.currency)}</strong><small>quantity × unit cost</small></article>
      <article className="panel"><span>Low / out of stock</span><strong>{metrics.low}</strong><small>needs attention</small></article>
    </section>

    <section className="panel v5-toolbar">
      <div className="search-box">⌕<input placeholder="Search name, SKU, barcode or category" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="ALL">All stock</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></select>
    </section>

    <section className="v5-inventory-grid">
      {filtered.map((row) => {
        const low = row.trackStock !== false && safeNumber(row.quantity) <= safeNumber(row.threshold ?? 5);
        const supplier = suppliers.find((item) => item.id === row.supplierId);
        const margin = safeNumber(row.price) - safeNumber(row.cost);
        return <article className={`panel v5-inventory-card ${low ? 'low' : ''}`} key={row.id}>
          <header><div className="v5-avatar">{(row.name || 'P').slice(0, 2).toUpperCase()}</div><div><h3>{row.name}</h3><p>{row.sku || 'No SKU'} · {row.category || 'Uncategorized'}</p></div><span className="v5-pill">{row.itemType || 'goods'}</span></header>
          <div className="v5-product-prices"><div><small>Sell</small><strong>{currency(row.price, settings.currency)}</strong></div><div><small>Cost</small><strong>{currency(row.cost, settings.currency)}</strong></div><div><small>Margin</small><strong>{currency(margin, settings.currency)}</strong></div></div>
          <div className="v5-stock-line"><div><small>On hand</small><strong>{row.trackStock === false ? 'Not tracked' : row.quantity}</strong></div><div><small>Low at</small><strong>{row.trackStock === false ? '—' : row.threshold}</strong></div><div><small>Location</small><strong>{row.location || 'Main Location'}</strong></div></div>
          <p className="v5-muted">{supplier ? `Supplier: ${supplier.name}` : 'No default supplier'}{row.barcode ? ` · Barcode: ${row.barcode}` : ''}</p>
          <footer className="row-actions"><button onClick={() => open(row)}>Edit</button>{row.trackStock !== false && <button onClick={() => { setAdjusting(row); setAdjustForm({ delta: 0, reason: 'Stock count correction', note: '' }); }}>Adjust stock</button>}<button className="danger" onClick={async () => { if (confirm(`Delete ${row.name}?`)) { await deleteRecord('products', row.id); notify('Inventory item deleted.'); } }}>Delete</button></footer>
        </article>;
      })}
    </section>

    {!filtered.length && <section className="panel"><EmptyState icon="□" title="No inventory items found" text="Add goods, spare parts, ingredients or services to start selling." /></section>}

    {stockMovements.length > 0 && <section className="panel v5-recent-movements"><div className="v5-section-heading"><div><p className="eyebrow">STOCK AUDIT</p><h3>Recent movements</h3></div></div><div className="v5-table-wrap"><table><thead><tr><th>Item</th><th>Change</th><th>After</th><th>Reason</th><th>Reference</th></tr></thead><tbody>{stockMovements.slice(0, 10).map((move) => <tr key={move.id}><td>{move.productName || move.productId}</td><td className={safeNumber(move.change) >= 0 ? 'v5-positive' : 'v5-negative'}>{safeNumber(move.change) > 0 ? '+' : ''}{move.change}</td><td>{move.quantityAfter}</td><td>{move.reason}</td><td>{move.reference || '—'}</td></tr>)}</tbody></table></div></section>}

    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit inventory item' : 'Add inventory item'} onClose={() => setEditing(null)}>
      <div className="form-grid v5-form-grid">
        <label className="wide"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label><span>Item type</span><select value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value, trackStock: e.target.value === 'service' ? false : form.trackStock })}>{ITEM_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
        <label><span>SKU</span><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label>
        <label><span>Barcode / GTIN</span><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></label>
        <label><span>Unit</span><input placeholder="pcs, kg, litre, hour" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
        <label><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
        <label><span>Default supplier</span><select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">No supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Unit cost</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
        <label><span>Retail price</span><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label><span>Wholesale price</span><input type="number" min="0" step="0.01" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} /></label>
        <label><span>Minimum wholesale qty</span><input type="number" min="1" value={form.minWholesaleQty} onChange={(e) => setForm({ ...form, minWholesaleQty: e.target.value })} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.trackStock)} onChange={(e) => setForm({ ...form, trackStock: e.target.checked })} /><span>Track stock quantity</span></label>
        {form.trackStock && <><label><span>Opening / current quantity</span><input type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><label><span>Low-stock threshold</span><input type="number" min="0" step="0.001" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></label></>}
        <label className="wide"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save item</button></footer>
    </Modal>

    <Modal open={Boolean(adjusting)} title={adjusting ? `Adjust stock — ${adjusting.name}` : 'Adjust stock'} onClose={() => setAdjusting(null)}>
      <div className="form-grid"><label><span>Change quantity</span><input type="number" step="0.001" value={adjustForm.delta} onChange={(e) => setAdjustForm({ ...adjustForm, delta: e.target.value })} /></label><label><span>Reason</span><select value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}><option>Stock count correction</option><option>Damaged / waste</option><option>Returned by customer</option><option>Internal use</option><option>Other</option></select></label><label className="wide"><span>Note</span><textarea rows="3" value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} /></label></div>
      <div className="alert alert-info">Use a positive number to add stock and a negative number to remove stock.</div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setAdjusting(null)}>Cancel</button><button className="button button-primary" onClick={adjust}>Apply adjustment</button></footer>
    </Modal>
  </div>;
}
