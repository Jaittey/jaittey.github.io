import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { supabase } from '../config/supabase';
import { saveAttendanceBatch } from '../services/database';
import { requireActiveBusinessId } from '../services/tenantContext';
import { currency, safeNumber } from '../utils/format';
import { attendanceFromShift, defaultAttendanceShift, timeRangeHours } from '../utils/payroll';

const paymentMethods = ['Cash', 'Card', 'Bank Transfer', 'Mobile Wallet', 'Other'];
const posViews = [
  ['checkout', 'Checkout'],
  ['inventory', 'Inventory'],
  ['analytics', 'Sales insights'],
  ['people', 'Customers & team'],
  ['locations', 'Locations'],
];

const dateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const timeNow = () => new Date().toTimeString().slice(0, 5);
const customerName = (customer) => customer?.name || customer?.customerName || 'Customer';
const productThreshold = (product) => Math.max(0, safeNumber(product.lowStockThreshold ?? product.reorderLevel ?? 5));

export default function POS({
  products = [],
  customers = [],
  invoices = [],
  employees = [],
  attendance = [],
  attendanceSettings = {},
  settings = {},
  user = {},
  notify = () => {},
  onNavigate = () => {},
}) {
  const [view, setView] = useState('checkout');
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [location, setLocation] = useState('Main Location');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(Number(settings.gstPercent || 0));
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const posSales = useMemo(() => invoices.filter((invoice) => invoice.source === 'POS'), [invoices]);
  const todaySales = useMemo(() => posSales.filter((invoice) => dateKey(invoice.date || invoice.createdAt) === today), [posSales, today]);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const selectedStaff = employees.find((employee) => employee.id === staffId);
  const selectedAttendance = attendance.find((record) => record.employeeId === staffId && record.date === today);

  const locations = useMemo(() => {
    const values = new Set(['Main Location']);
    products.forEach((product) => product.location && values.add(product.location));
    employees.forEach((employee) => employee.workLocation && values.add(employee.workLocation));
    posSales.forEach((sale) => (sale.location || sale.locationName) && values.add(sale.location || sale.locationName));
    return [...values];
  }, [products, employees, posSales]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => !query || `${product.name || ''} ${product.sku || ''}`.toLowerCase().includes(query));
  }, [products, search]);

  const lowStock = useMemo(() => products.filter((product) => (
    safeNumber(product.quantity) <= productThreshold(product)
  )), [products]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + safeNumber(item.price) * safeNumber(item.qty), 0);
    const discount = subtotal * Math.min(100, Math.max(0, safeNumber(discountPercent))) / 100;
    const taxable = Math.max(0, subtotal - discount);
    const gst = taxable * Math.min(100, Math.max(0, safeNumber(gstPercent))) / 100;
    return { subtotal, discount, gst, total: taxable + gst };
  }, [cart, discountPercent, gstPercent]);

  const sevenDayTrend = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - offset));
    const key = day.toISOString().slice(0, 10);
    const sales = posSales.filter((sale) => dateKey(sale.date || sale.createdAt) === key);
    return {
      key,
      label: day.toLocaleDateString('en', { weekday: 'short' }),
      revenue: sales.reduce((sum, sale) => sum + safeNumber(sale.total), 0),
      transactions: sales.length,
    };
  }), [posSales]);

  const topSellers = useMemo(() => {
    const items = {};
    posSales.forEach((sale) => (sale.items || []).forEach((item) => {
      const key = item.productId || item.name;
      if (!key) return;
      items[key] ||= { name: item.name || 'Item', quantity: 0, revenue: 0 };
      items[key].quantity += safeNumber(item.quantity || item.qty);
      items[key].revenue += safeNumber(item.amount || safeNumber(item.quantity || item.qty) * safeNumber(item.unitPrice || item.price));
    }));
    return Object.values(items).sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [posSales]);

  const customerProfile = useMemo(() => {
    if (!selectedCustomer) return null;
    const history = posSales.filter((sale) => sale.customerId === selectedCustomer.id);
    const spend = history.reduce((sum, sale) => sum + safeNumber(sale.total), 0);
    return { history, spend, points: safeNumber(selectedCustomer.loyaltyPoints) + Math.floor(spend / 10) };
  }, [posSales, selectedCustomer]);

  const staffPerformance = useMemo(() => employees.map((employee) => {
    const sales = posSales.filter((sale) => sale.staffId === employee.id || sale.operatorId === employee.id);
    return {
      id: employee.id,
      name: employee.name || employee.employeeName || 'Employee',
      role: employee.designation || employee.role || 'Team member',
      sales: sales.length,
      revenue: sales.reduce((sum, sale) => sum + safeNumber(sale.total), 0),
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 6), [employees, posSales]);

  const locationPerformance = useMemo(() => locations.map((name) => {
    const sales = posSales.filter((sale) => (sale.location || sale.locationName || 'Main Location') === name);
    return {
      name,
      sales: sales.length,
      revenue: sales.reduce((sum, sale) => sum + safeNumber(sale.total), 0),
      staff: employees.filter((employee) => (employee.workLocation || 'Main Location') === name).length,
      stock: products.filter((product) => (product.location || 'Main Location') === name).reduce((sum, product) => sum + safeNumber(product.quantity), 0),
    };
  }), [locations, employees, posSales, products]);

  const maxTrend = Math.max(1, ...sevenDayTrend.map((item) => item.revenue));
  const todayRevenue = todaySales.reduce((sum, sale) => sum + safeNumber(sale.total), 0);
  const stockValue = products.reduce((sum, product) => sum + safeNumber(product.quantity) * safeNumber(product.cost || product.price), 0);
  const activeShifts = attendance.filter((record) => record.date === today && record.actualStart && !record.actualEnd).length;
  const changeDue = paymentMethod === 'Cash' ? Math.max(0, safeNumber(cashReceived) - totals.total) : 0;

  const addProduct = (product) => {
    const stock = safeNumber(product.quantity);
    if (stock <= 0) return notify('This product is out of stock.', 'error');
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing?.qty >= stock) {
        notify('Not enough stock is available.', 'error');
        return current;
      }
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { ...product, qty: 1 }];
    });
  };

  const changeQty = (productId, delta) => setCart((current) => current
    .map((item) => item.id === productId
      ? { ...item, qty: Math.max(0, Math.min(safeNumber(item.quantity), item.qty + delta)) }
      : item)
    .filter((item) => item.qty > 0));

  const completeSale = async () => {
    if (!cart.length || totals.total <= 0) return;
    if (paymentMethod === 'Cash' && safeNumber(cashReceived) < totals.total) {
      notify('Cash received must cover the sale total.', 'error');
      return;
    }
    setBusy(true);
    try {
      const invoiceNumber = `POS-${today.replaceAll('-', '')}-${String(Date.now()).slice(-6)}`;
      const invoice = {
        invoiceNumber,
        source: 'POS',
        status: 'PAID',
        customerId: selectedCustomer?.id || '',
        customerName: selectedCustomer ? customerName(selectedCustomer) : 'Walk-in Customer',
        staffId: selectedStaff?.id || '',
        staffName: selectedStaff?.name || user?.displayName || user?.email || 'POS operator',
        operatorId: user?.id || user?.uid || '',
        location,
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
        paymentReference: paymentReference.trim(),
        cashReceived: paymentMethod === 'Cash' ? safeNumber(cashReceived) : totals.total,
        changeDue,
        loyaltyPointsEarned: selectedCustomer ? Math.floor(totals.total / 10) : 0,
        date: today,
      };

      const { error } = await supabase.rpc('sb_complete_pos_sale', {
        p_business_id: requireActiveBusinessId(),
        p_invoice: invoice,
        p_payment: {
          amount: totals.total,
          paymentMethod,
          paymentReference: paymentReference.trim(),
          paymentDate: today,
          status: 'PAID',
          location,
        },
      });
      if (error) throw error;

      setReceipt(invoice);
      setCart([]);
      setCustomerId('');
      setDiscountPercent(0);
      setPaymentReference('');
      setCashReceived('');
      notify(`Sale ${invoiceNumber} completed and inventory updated.`);
    } catch (reason) {
      notify(reason?.message || 'Could not complete the POS sale.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const recordShift = async (action) => {
    if (!selectedStaff) return notify('Choose a team member first.', 'error');
    if (action === 'out' && !selectedAttendance?.actualStart) return notify('This team member has not clocked in.', 'error');
    setShiftBusy(true);
    try {
      const currentTime = timeNow();
      const shift = defaultAttendanceShift(attendanceSettings);
      const overrides = action === 'in'
        ? { status: 'PRESENT', actualStart: currentTime, actualEnd: '', actualHours: 0, notes: 'Clocked in from POS' }
        : {
            ...selectedAttendance,
            status: 'PRESENT',
            actualStart: selectedAttendance.actualStart,
            actualEnd: currentTime,
            actualHours: timeRangeHours(selectedAttendance.actualStart, currentTime),
            notes: selectedAttendance.notes || 'Clocked out from POS',
          };
      await saveAttendanceBatch([attendanceFromShift(selectedStaff, today, shift, overrides)]);
      notify(`${selectedStaff.name || 'Team member'} clocked ${action === 'in' ? 'in' : 'out'} at ${currentTime}.`);
    } catch (reason) {
      notify(reason?.message || 'Could not update the staff shift.', 'error');
    } finally {
      setShiftBusy(false);
    }
  };

  return (
    <div className="pos-page pos-command-center">
      <section className="pos-command-hero panel">
        <div>
          <p className="eyebrow">LIVE COMMERCE CONTROL</p>
          <h2>Point of Sale</h2>
          <p>Checkout, stock, customer loyalty, staff shifts and every location in one synchronized workspace.</p>
        </div>
        <div className="pos-live-chip"><i />LIVE SYNC <span>{location}</span></div>
      </section>

      <section className="pos-kpi-grid">
        <article className="panel"><span>Today’s revenue</span><strong>{currency(todayRevenue, settings.currency)}</strong><small>{todaySales.length} completed transaction(s)</small></article>
        <article className="panel"><span>Low-stock alerts</span><strong>{lowStock.length}</strong><small>{lowStock.length ? 'Items need attention' : 'Inventory is healthy'}</small></article>
        <article className="panel"><span>Inventory value</span><strong>{currency(stockValue, settings.currency)}</strong><small>{products.reduce((sum, item) => sum + safeNumber(item.quantity), 0)} units available</small></article>
        <article className="panel"><span>Team on shift</span><strong>{activeShifts}</strong><small>{employees.length} registered employee(s)</small></article>
      </section>

      <nav className="pos-view-tabs" aria-label="POS workspace views">
        {posViews.map(([id, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}
      </nav>

      {view === 'checkout' && <>
        <div className="pos-layout">
          <section className="panel pos-products-panel">
            <div className="pos-toolbar pos-toolbar-expanded">
              <div className="search-box">⌕<input placeholder="Search product or SKU" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <select aria-label="Customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Walk-in Customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customerName(customer)}</option>)}
              </select>
              <select aria-label="Store location" value={location} onChange={(event) => setLocation(event.target.value)}>
                {locations.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            {selectedCustomer && <div className="pos-customer-strip"><span>{customerName(selectedCustomer)}</span><small>{customerProfile?.history.length || 0} purchases · {customerProfile?.points || 0} loyalty points</small></div>}
            <div className="pos-product-grid">
              {filteredProducts.map((product) => {
                const isLow = safeNumber(product.quantity) <= productThreshold(product);
                return <button type="button" className={`pos-product-card ${isLow ? 'low-stock' : ''}`} key={product.id} disabled={safeNumber(product.quantity) <= 0} onClick={() => addProduct(product)}>
                  <span>{(product.name || 'P').slice(0, 2).toUpperCase()}</span>
                  <div><strong>{product.name || 'Product'}</strong><small>{product.sku || 'No SKU'}</small></div>
                  <b>{currency(product.price, settings.currency)}</b>
                  <small>{safeNumber(product.quantity)} in stock {isLow && '· LOW'}</small>
                </button>;
              })}
              {!filteredProducts.length && <div className="empty-backup-state">No products match this search.</div>}
            </div>
          </section>

          <section className="panel pos-cart-panel">
            <div className="panel-heading"><div><p className="eyebrow">ACTIVE CART</p><h2>Current sale</h2></div>{cart.length > 0 && <button type="button" className="pos-clear-cart" onClick={() => setCart([])}>Clear</button>}</div>
            <div className="pos-cart-list">
              {cart.map((item) => <div className="pos-cart-row" key={item.id}>
                <div><strong>{item.name}</strong><small>{currency(item.price, settings.currency)} each</small></div>
                <div className="pos-qty"><button type="button" onClick={() => changeQty(item.id, -1)}>−</button><b>{item.qty}</b><button type="button" onClick={() => changeQty(item.id, 1)}>+</button></div>
                <strong>{currency(safeNumber(item.price) * item.qty, settings.currency)}</strong>
              </div>)}
              {!cart.length && <div className="pos-empty-cart"><span>＋</span><strong>Ready for a new sale</strong><small>Select an item from inventory to begin checkout.</small></div>}
            </div>
            <div className="form-grid pos-adjustments">
              <label><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} /></label>
              <label><span>GST %</span><input type="number" min="0" max="100" step="0.01" value={gstPercent} onChange={(event) => setGstPercent(event.target.value)} /></label>
              <label><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
              <label><span>{paymentMethod === 'Cash' ? 'Cash received' : 'Reference'}</span>{paymentMethod === 'Cash' ? <input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /> : <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional" />}</label>
            </div>
            <div className="pos-totals">
              <div><span>Subtotal</span><strong>{currency(totals.subtotal, settings.currency)}</strong></div>
              <div><span>Discount</span><strong>− {currency(totals.discount, settings.currency)}</strong></div>
              <div><span>GST</span><strong>{currency(totals.gst, settings.currency)}</strong></div>
              {paymentMethod === 'Cash' && <div className="pos-change-due"><span>Change due</span><strong>{currency(changeDue, settings.currency)}</strong></div>}
              <div className="pos-grand-total"><span>Total</span><strong>{currency(totals.total, settings.currency)}</strong></div>
            </div>
            <button className="button button-primary pos-checkout" disabled={!cart.length || busy} onClick={completeSale}>{busy ? 'Processing secure payment…' : `Complete sale · ${currency(totals.total, settings.currency)}`}</button>
          </section>
        </div>

        <section className="panel pos-recent-panel">
          <div className="pos-section-heading"><div><p className="eyebrow">TRANSACTION STREAM</p><h2>Recent counter sales</h2></div><button className="button button-secondary" type="button" onClick={() => onNavigate('invoices')}>View invoices</button></div>
          <div className="responsive-table"><table><thead><tr><th>Sale</th><th>Customer</th><th>Location</th><th>Payment</th><th>Total</th></tr></thead><tbody>
            {posSales.slice(0, 8).map((invoice) => <tr key={invoice.id || invoice.invoiceNumber}><td data-label="Sale">{invoice.invoiceNumber || invoice.id}</td><td data-label="Customer">{invoice.customerName || 'Walk-in Customer'}</td><td data-label="Location">{invoice.location || 'Main Location'}</td><td data-label="Payment">{invoice.paymentMethod || '—'}</td><td data-label="Total">{currency(invoice.total, settings.currency)}</td></tr>)}
            {!posSales.length && <tr><td colSpan="5">No POS sales yet.</td></tr>}
          </tbody></table></div>
        </section>
      </>}

      {view === 'inventory' && <section className="panel pos-workspace-panel">
        <div className="pos-section-heading"><div><p className="eyebrow">REAL-TIME INVENTORY</p><h2>Stock control & alerts</h2></div><button className="button button-primary" type="button" onClick={() => onNavigate('products')}>Manage inventory</button></div>
        <div className="pos-inventory-summary"><div><span>Products</span><strong>{products.length}</strong></div><div><span>Total units</span><strong>{products.reduce((sum, item) => sum + safeNumber(item.quantity), 0)}</strong></div><div><span>Low stock</span><strong>{lowStock.length}</strong></div><div><span>Out of stock</span><strong>{products.filter((item) => safeNumber(item.quantity) <= 0).length}</strong></div></div>
        <div className="responsive-table"><table><thead><tr><th>Product</th><th>SKU</th><th>Location</th><th>Available</th><th>Reorder at</th><th>Status</th></tr></thead><tbody>
          {[...products].sort((a, b) => safeNumber(a.quantity) - safeNumber(b.quantity)).map((product) => { const quantity = safeNumber(product.quantity); const threshold = productThreshold(product); return <tr key={product.id}><td data-label="Product">{product.name || 'Product'}</td><td data-label="SKU">{product.sku || '—'}</td><td data-label="Location">{product.location || 'Main Location'}</td><td data-label="Available">{quantity}</td><td data-label="Reorder at">{threshold}</td><td data-label="Status"><span className={`status ${quantity <= 0 ? 'status-overdue' : quantity <= threshold ? 'status-pending' : 'status-paid'}`}>{quantity <= 0 ? 'OUT' : quantity <= threshold ? 'LOW' : 'HEALTHY'}</span></td></tr>; })}
          {!products.length && <tr><td colSpan="6">Add products to start real-time stock tracking.</td></tr>}
        </tbody></table></div>
      </section>}

      {view === 'analytics' && <div className="pos-analytics-grid">
        <section className="panel pos-trend-panel"><div className="pos-section-heading"><div><p className="eyebrow">7-DAY PERFORMANCE</p><h2>Revenue trend</h2></div><strong>{currency(sevenDayTrend.reduce((sum, item) => sum + item.revenue, 0), settings.currency)}</strong></div><div className="pos-trend-chart">{sevenDayTrend.map((item) => <div key={item.key}><span style={{ height: `${Math.max(5, item.revenue / maxTrend * 100)}%` }} title={currency(item.revenue, settings.currency)} /><b>{item.label}</b><small>{item.transactions}</small></div>)}</div></section>
        <section className="panel"><div className="pos-section-heading"><div><p className="eyebrow">PRODUCT SIGNALS</p><h2>Top-selling items</h2></div></div><div className="pos-ranking-list">{topSellers.map((item, index) => <div key={item.name}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.quantity} units sold</small></div><b>{currency(item.revenue, settings.currency)}</b></div>)}{!topSellers.length && <div className="empty-backup-state">Sales rankings will appear after checkout.</div>}</div></section>
      </div>}

      {view === 'people' && <div className="pos-operations-grid">
        <section className="panel pos-crm-panel"><div className="pos-section-heading"><div><p className="eyebrow">CUSTOMER CRM</p><h2>Profiles & loyalty</h2></div><button className="button button-secondary" type="button" onClick={() => onNavigate('customers')}>Customer list</button></div><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customerName(customer)}</option>)}</select>{customerProfile ? <div className="pos-customer-profile"><div className="pos-customer-profile-head"><span>{customerName(selectedCustomer).slice(0, 2).toUpperCase()}</span><div><strong>{customerName(selectedCustomer)}</strong><small>{selectedCustomer.email || selectedCustomer.phone || 'Customer profile'}</small></div></div><div className="pos-customer-metrics"><div><span>Lifetime spend</span><strong>{currency(customerProfile.spend, settings.currency)}</strong></div><div><span>Purchases</span><strong>{customerProfile.history.length}</strong></div><div><span>Loyalty points</span><strong>{customerProfile.points}</strong></div></div><div className="pos-customer-history">{customerProfile.history.slice(0, 4).map((sale) => <div key={sale.id || sale.invoiceNumber}><span>{sale.invoiceNumber || 'POS sale'}</span><small>{dateKey(sale.date || sale.createdAt)}</small><strong>{currency(sale.total, settings.currency)}</strong></div>)}{!customerProfile.history.length && <small>No purchase history yet.</small>}</div></div> : <div className="empty-backup-state">Select a customer to view purchase history and loyalty value.</div>}</section>
        <section className="panel"><div className="pos-section-heading"><div><p className="eyebrow">TEAM OPERATIONS</p><h2>Shift & performance</h2></div></div><select className="pos-staff-select" value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="">Choose a team member</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name || employee.employeeName || 'Employee'}</option>)}</select><div className="pos-shift-card"><i className={`pos-shift-dot ${selectedAttendance?.actualStart && !selectedAttendance?.actualEnd ? 'active' : ''}`} /><div><strong>{selectedAttendance?.actualStart && !selectedAttendance?.actualEnd ? 'Shift in progress' : selectedAttendance?.actualEnd ? 'Shift completed' : 'Not clocked in'}</strong><small>{selectedAttendance?.actualStart ? `${selectedAttendance.actualStart}${selectedAttendance.actualEnd ? ` – ${selectedAttendance.actualEnd}` : ''}` : 'Use secure POS attendance controls'}</small></div><div><button className="button button-secondary" type="button" disabled={!selectedStaff || shiftBusy || Boolean(selectedAttendance?.actualStart)} onClick={() => recordShift('in')}>Clock in</button><button className="button button-primary" type="button" disabled={!selectedStaff || shiftBusy || !selectedAttendance?.actualStart || Boolean(selectedAttendance?.actualEnd)} onClick={() => recordShift('out')}>Clock out</button></div></div><div className="pos-staff-performance">{staffPerformance.map((member) => <div key={member.id}><span>{member.name.slice(0, 2).toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.role} · {member.sales} sales</small></div><b>{currency(member.revenue, settings.currency)}</b></div>)}{!staffPerformance.length && <div className="empty-backup-state">Employee sales performance will appear here.</div>}</div></section>
      </div>}

      {view === 'locations' && <section className="panel pos-workspace-panel"><div className="pos-section-heading"><div><p className="eyebrow">UNIFIED COMMERCE</p><h2>Multi-location syncing</h2></div><span className="pos-sync-status"><i />All data synchronized</span></div><div className="pos-location-grid">{locationPerformance.map((item) => <article key={item.name}><div className="pos-location-head"><span>⌂</span><div><strong>{item.name}</strong><small>Connected store</small></div></div><div className="pos-location-metrics"><div><span>Revenue</span><strong>{currency(item.revenue, settings.currency)}</strong></div><div><span>Transactions</span><strong>{item.sales}</strong></div><div><span>Stock units</span><strong>{item.stock}</strong></div><div><span>Team</span><strong>{item.staff}</strong></div></div><footer><i />Inventory and sales are live</footer></article>)}</div></section>}

      <Modal open={Boolean(receipt)} title="Sale completed" onClose={() => setReceipt(null)}>
        {receipt && <div className="pos-receipt-paper"><div className="pos-receipt-brand"><span>SB</span><div><strong>{settings.companyName || 'Small Business'}</strong><small>{receipt.location}</small></div></div><h3>Payment receipt</h3><div className="pos-receipt-meta"><span>{receipt.invoiceNumber}</span><span>{receipt.date}</span></div><div className="pos-receipt-items">{receipt.items.map((item) => <div key={item.productId || item.name}><span>{item.quantity} × {item.name}</span><strong>{currency(item.amount, settings.currency)}</strong></div>)}</div><div className="pos-receipt-total"><span>Total paid</span><strong>{currency(receipt.total, settings.currency)}</strong></div>{receipt.changeDue > 0 && <div className="pos-receipt-change"><span>Change</span><strong>{currency(receipt.changeDue, settings.currency)}</strong></div>}<p>Paid by {receipt.paymentMethod} · {receipt.customerName}</p><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setReceipt(null)}>Done</button><button type="button" className="button button-primary" onClick={() => window.print()}>Print receipt</button></div></div>}
      </Modal>
    </div>
  );
}
