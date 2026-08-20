import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { saveRecord } from '../services/database';
import { completePosSaleV5 } from '../services/commerce';
import { currency, safeNumber } from '../utils/format';

const POS_TYPES = [
  { id: 'retail', icon: '▦', title: 'Shop / Retail', description: 'Fast barcode/SKU checkout, walk-in customers, stock and receipts.' },
  { id: 'restaurant', icon: '☕', title: 'Restaurant / Café', description: 'Menu tiles, modifiers, tables, dining options and kitchen tickets.' },
  { id: 'garage', icon: '⚙', title: 'Garage / Workshop', description: 'Parts + labour checkout with vehicle and work-order context.' },
  { id: 'wholesale', icon: '▤', title: 'Wholesale', description: 'Bulk quantities, customer accounts and wholesale pricing.' },
];

const paymentMethods = ['Cash', 'Card', 'Bank Transfer', 'Mobile Wallet', 'Other'];
const defaultProfile = { businessType: '', defaultLocation: 'Main Location', restaurantTables: 12, defaultDiningOption: 'Dine in', wholesaleCustomerRequired: true };
const menuBlank = { name: '', category: 'Main', price: 0, posName: '', kitchenName: '', active: true, modifiersText: '', recipe: [] };

const customerName = (customer) => customer?.name || customer?.customerName || 'Customer';
const productStock = (product) => safeNumber(product.quantity);
const productTracksStock = (product) => product.trackStock !== false && product.itemType !== 'service';
const today = () => new Date().toISOString().slice(0, 10);
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const parseModifiers = (text='') => String(text).split(/\r?\n/).map((line)=>line.trim()).filter(Boolean).map((line)=>{
  const [name, price='0'] = line.split('|');
  return { name: String(name||'').trim(), price: safeNumber(price) };
}).filter((x)=>x.name);

export default function POS({
  products = [], customers = [], invoices = [], employees = [],
  posProfile = null, menuItems = [], restaurantOrders = [], serviceJobs = [],
  settings = {}, user = {}, notify = () => {}, onNavigate = () => {},
}) {
  const [profileEditor, setProfileEditor] = useState(!posProfile);
  const [profileForm, setProfileForm] = useState({ ...defaultProfile, ...(posProfile || {}) });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(Number(settings.gstPercent || 0));
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [view, setView] = useState('sale');

  // Restaurant state
  const [diningOption, setDiningOption] = useState(posProfile?.defaultDiningOption || 'Dine in');
  const [tableNumber, setTableNumber] = useState('');
  const [menuEditor, setMenuEditor] = useState(null);
  const [menuForm, setMenuForm] = useState(menuBlank);
  const [modifierItem, setModifierItem] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [activeRestaurantOrderId, setActiveRestaurantOrderId] = useState('');

  // Garage state
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [jobNote, setJobNote] = useState('');

  const mode = posProfile?.businessType || profileForm.businessType || '';
  const modeMeta = POS_TYPES.find((item)=>item.id===mode) || POS_TYPES[0];
  const selectedCustomer = customers.find((customer)=>customer.id===customerId);
  const selectedStaff = employees.find((employee)=>employee.id===staffId);

  const locations = useMemo(()=>[...new Set(['Main Location', posProfile?.defaultLocation, ...products.map((x)=>x.location).filter(Boolean)])].filter(Boolean),[products,posProfile]);
  const [location,setLocation] = useState(posProfile?.defaultLocation || 'Main Location');

  const categories = useMemo(()=>{
    const source = mode==='restaurant' ? menuItems : products;
    return [...new Set(source.map((item)=>item.category).filter(Boolean))].sort();
  },[mode,menuItems,products]);

  const catalogue = useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(mode==='restaurant') return menuItems.filter((item)=>item.active!==false&&(category==='ALL'||item.category===category)&&(!q||`${item.name||''} ${item.posName||''} ${item.category||''}`.toLowerCase().includes(q)));
    return products.filter((product)=>{
      if(category!=='ALL'&&product.category!==category)return false;
      if(!q)return true;
      return `${product.name||''} ${product.sku||''} ${product.barcode||''} ${product.category||''}`.toLowerCase().includes(q);
    });
  },[mode,products,menuItems,search,category]);

  const posSales = useMemo(()=>invoices.filter((x)=>['POS','RESTAURANT_POS','GARAGE_POS','WHOLESALE_POS'].includes(x.source)),[invoices]);
  const todaySales = useMemo(()=>posSales.filter((x)=>String(x.date||x.createdAt||'').slice(0,10)===today()),[posSales]);
  const todayRevenue=todaySales.reduce((s,x)=>s+safeNumber(x.total),0);
  const openKitchenOrders=restaurantOrders.filter((x)=>!['PAID','CANCELLED','SERVED'].includes(String(x.status||'').toUpperCase()));
  const openJobs=serviceJobs.filter((x)=>!['COMPLETED','CANCELLED'].includes(String(x.status||'').toUpperCase()));

  const totals = useMemo(()=>{
    const subtotal=cart.reduce((sum,item)=>sum+safeNumber(item.price)*safeNumber(item.qty),0);
    const discount=subtotal*Math.min(100,Math.max(0,safeNumber(discountPercent)))/100;
    const taxable=Math.max(0,subtotal-discount);
    const gst=taxable*Math.min(100,Math.max(0,safeNumber(gstPercent)))/100;
    return {subtotal,discount,gst,total:taxable+gst};
  },[cart,discountPercent,gstPercent]);

  const saveProfile = async () => {
    if(!profileForm.businessType) return notify('Choose how this POS will be used.','error');
    await saveRecord('posProfiles',{...profileForm,defaultLocation:profileForm.defaultLocation.trim()||'Main Location',configuredAt:new Date().toISOString()},'main');
    setLocation(profileForm.defaultLocation.trim()||'Main Location');
    setProfileEditor(false); notify('POS workspace configured.');
  };

  const cartKey = (baseId, modifiers=[]) => `${baseId}:${modifiers.map((x)=>x.name).sort().join('|')}`;
  const pushCart = (item) => setCart((current)=>{
    const existing=current.find((x)=>x.key===item.key);
    if(existing){
      if(item.maxQty!=null&&existing.qty>=item.maxQty){notify('Not enough stock is available.','error');return current;}
      return current.map((x)=>x.key===item.key?{...x,qty:x.qty+1}:x);
    }
    return [...current,item];
  });

  const addProduct = (product) => {
    const tracks=productTracksStock(product);
    if(tracks&&productStock(product)<=0)return notify('This item is out of stock.','error');
    const price=mode==='wholesale'&&safeNumber(product.wholesalePrice)>0?safeNumber(product.wholesalePrice):safeNumber(product.price);
    const startingQty=mode==='wholesale'?Math.max(1,safeNumber(product.minWholesaleQty||1)):1;
    if(tracks&&productStock(product)<startingQty)return notify(`Only ${productStock(product)} unit(s) are available; the wholesale minimum is ${startingQty}.`,'error');
    pushCart({key:cartKey(product.id),id:product.id,productId:product.id,name:product.name,sku:product.sku||'',price,qty:startingQty,maxQty:tracks?productStock(product):null,trackStock:tracks,stockImpacts:tracks?[{productId:product.id,quantity:1}]:[],itemType:product.itemType||'goods',minQty:startingQty});
  };

  const addMenuItem = (item, modifiers=[]) => {
    const modifierPrice=modifiers.reduce((s,x)=>s+safeNumber(x.price),0);
    const stockImpacts=(item.recipe||[]).map((row)=>({productId:row.productId,quantity:safeNumber(row.quantity)})).filter((row)=>row.productId&&row.quantity>0);
    pushCart({key:cartKey(item.id,modifiers),id:item.id,menuItemId:item.id,name:item.posName||item.name,price:safeNumber(item.price)+modifierPrice,qty:1,modifiers,stockImpacts,itemType:'menu'});
  };

  const chooseCatalogueItem = (item) => {
    if(mode!=='restaurant')return addProduct(item);
    if((item.modifiers||[]).length){setModifierItem(item);setSelectedModifiers([]);return;}
    addMenuItem(item,[]);
  };

  const setQty=(key,qty)=>setCart((current)=>current.map((x)=>{
    if(x.key!==key)return x;
    const requested=safeNumber(qty);
    if(requested<=0)return {...x,qty:0};
    const minimum=Math.max(1,safeNumber(x.minQty||1));
    return {...x,qty:Math.max(minimum,Math.min(x.maxQty??999999,requested))};
  }).filter((x)=>x.qty>0));

  const restaurantStockProblem = () => {
    if(mode!=='restaurant')return '';
    const needed=new Map();
    cart.forEach((item)=>(item.stockImpacts||[]).forEach((impact)=>{
      const quantity=safeNumber(impact.quantity)*safeNumber(item.qty);
      needed.set(impact.productId,(needed.get(impact.productId)||0)+quantity);
    }));
    for(const [productId,quantity] of needed){
      const product=products.find((row)=>row.id===productId);
      if(!product) return 'A recipe ingredient no longer exists in Inventory.';
      if(productTracksStock(product)&&productStock(product)<quantity){
        return `${product.name} needs ${quantity} ${product.unit||'unit(s)'}, but only ${productStock(product)} are available.`;
      }
    }
    return '';
  };

  const checkout = async () => {
    if(!cart.length)return notify('Add at least one item.','error');
    if(mode==='wholesale'&&posProfile?.wholesaleCustomerRequired!==false&&!selectedCustomer)return notify('Choose a customer for a wholesale sale.','error');
    if(mode==='garage'&&!vehicleRegistration.trim())return notify('Enter the vehicle registration before checkout.','error');
    if(paymentMethod==='Cash'&&safeNumber(cashReceived)<totals.total)return notify('Cash received must cover the total.','error');
    setBusy(true);
    try{
      const source=mode==='restaurant'?'RESTAURANT_POS':mode==='garage'?'GARAGE_POS':mode==='wholesale'?'WHOLESALE_POS':'POS';
      const invoiceNumber=`${mode==='restaurant'?'RST':mode==='garage'?'GAR':mode==='wholesale'?'WHL':'POS'}-${today().replaceAll('-','')}-${String(Date.now()).slice(-6)}`;
      const items=cart.map((item)=>({productId:item.productId||'',menuItemId:item.menuItemId||'',name:item.name,quantity:item.qty,unitPrice:safeNumber(item.price),amount:safeNumber(item.price)*item.qty,modifiers:item.modifiers||[],trackStock:item.trackStock!==false,stockImpacts:(item.stockImpacts||[]).map((impact)=>({...impact,quantity:safeNumber(impact.quantity)*item.qty}))}));
      const invoice={invoiceNumber,source,status:'PAID',posType:mode,customerId:selectedCustomer?.id||'',customerName:selectedCustomer?customerName(selectedCustomer):'Walk-in Customer',staffId:selectedStaff?.id||'',staffName:selectedStaff?.name||user?.displayName||user?.email||'POS operator',operatorId:user?.id||user?.uid||'',location,items,subtotal:totals.subtotal,discount:totals.discount,gst:totals.gst,total:totals.total,paymentMethod,paymentReference:paymentReference.trim(),cashReceived:paymentMethod==='Cash'?safeNumber(cashReceived):totals.total,changeDue:paymentMethod==='Cash'?Math.max(0,safeNumber(cashReceived)-totals.total):0,date:today(),diningOption:mode==='restaurant'?diningOption:'',tableNumber:mode==='restaurant'?tableNumber:'',vehicleRegistration:mode==='garage'?vehicleRegistration.trim().toUpperCase():'',vehicle:mode==='garage'?vehicleMakeModel.trim():''};
      await completePosSaleV5(invoice,{amount:totals.total,paymentMethod,paymentReference:paymentReference.trim(),paymentDate:today(),status:'PAID',location});
      if(activeRestaurantOrderId)await saveRecord('restaurantOrders',{status:'PAID',paidAt:new Date().toISOString(),invoiceNumber},activeRestaurantOrderId);
      if(mode==='garage'&&vehicleRegistration.trim())await saveRecord('serviceJobs',{jobNumber:`JOB-${String(Date.now()).slice(-8)}`,customerId:selectedCustomer?.id||'',vehicleRegistration:vehicleRegistration.trim().toUpperCase(),vehicleMakeModel:vehicleMakeModel.trim(),complaint:jobNote.trim(),status:'COMPLETED',items,invoiceNumber,total:totals.total,completedAt:new Date().toISOString()});
      setReceipt(invoice);setCart([]);setCustomerId('');setDiscountPercent(0);setPaymentReference('');setCashReceived('');setActiveRestaurantOrderId('');setTableNumber('');setVehicleRegistration('');setVehicleMakeModel('');setJobNote('');notify(`Sale ${invoiceNumber} completed and stock synchronized.`);
    }catch(error){notify(error.message||'Could not complete sale.','error');}finally{setBusy(false);}
  };

  const sendKitchen = async () => {
    if(!cart.length)return notify('Add menu items first.','error');
    const stockProblem=restaurantStockProblem();
    if(stockProblem)return notify(stockProblem,'error');
    const orderNumber=`K-${String(Date.now()).slice(-6)}`;
    await saveRecord('restaurantOrders',{orderNumber,status:'NEW',diningOption,tableNumber,customerId:selectedCustomer?.id||'',customerName:selectedCustomer?customerName(selectedCustomer):'Guest',items:cart.map((x)=>({...x,quantity:x.qty})),subtotal:totals.subtotal,total:totals.total,orderTime:new Date().toISOString()});
    setCart([]);setTableNumber('');notify(`${orderNumber} sent to kitchen.`);
  };

  const loadRestaurantOrder=(order)=>{setCart((order.items||[]).map((x)=>({...x,key:x.key||cartKey(x.menuItemId||x.id||newId(),x.modifiers||[]),qty:safeNumber(x.quantity||x.qty||1)})));setDiningOption(order.diningOption||'Dine in');setTableNumber(order.tableNumber||'');setCustomerId(order.customerId||'');setActiveRestaurantOrderId(order.id);setView('sale');};

  const openMenuEditor=(item=null)=>{setMenuEditor(item||{});setMenuForm({...menuBlank,...(item||{}),modifiersText:(item?.modifiers||[]).map((x)=>`${x.name}|${safeNumber(x.price)}`).join('\n'),recipe:(item?.recipe||[]).map((x)=>({...x}))});};
  const saveMenu=async()=>{if(!menuForm.name.trim())return notify('Menu item name is required.','error');await saveRecord('menuItems',{...menuForm,name:menuForm.name.trim(),posName:menuForm.posName.trim(),kitchenName:menuForm.kitchenName.trim(),category:menuForm.category.trim()||'Main',price:safeNumber(menuForm.price),modifiers:parseModifiers(menuForm.modifiersText),recipe:(menuForm.recipe||[]).filter((x)=>x.productId&&safeNumber(x.quantity)>0).map((x)=>({productId:x.productId,quantity:safeNumber(x.quantity)}))},menuEditor?.id||null);setMenuEditor(null);notify('Restaurant menu item saved.');};

  if(profileEditor||!mode){return <div className="v5-page"><section className="v5-pos-setup panel"><p className="eyebrow">SB v5.0 ADAPTIVE POS</p><h2>What will this POS be used for?</h2><p>The workspace changes automatically for the way this business actually sells.</p><div className="v5-pos-type-grid">{POS_TYPES.map((type)=><button key={type.id} className={profileForm.businessType===type.id?'active':''} onClick={()=>setProfileForm({...profileForm,businessType:type.id})}><span>{type.icon}</span><strong>{type.title}</strong><small>{type.description}</small></button>)}</div><div className="form-grid v5-pos-setup-fields"><label><span>Default location</span><input value={profileForm.defaultLocation} onChange={e=>setProfileForm({...profileForm,defaultLocation:e.target.value})}/></label>{profileForm.businessType==='restaurant'&&<><label><span>Number of tables</span><input type="number" min="0" value={profileForm.restaurantTables} onChange={e=>setProfileForm({...profileForm,restaurantTables:e.target.value})}/></label><label><span>Default dining option</span><select value={profileForm.defaultDiningOption} onChange={e=>setProfileForm({...profileForm,defaultDiningOption:e.target.value})}><option>Dine in</option><option>Takeaway</option><option>Delivery</option></select></label></>}{profileForm.businessType==='wholesale'&&<label className="checkbox-label"><input type="checkbox" checked={Boolean(profileForm.wholesaleCustomerRequired)} onChange={e=>setProfileForm({...profileForm,wholesaleCustomerRequired:e.target.checked})}/><span>Require customer for wholesale checkout</span></label>}</div><footer className="modal-actions"><button className="button button-primary" onClick={saveProfile}>Create {POS_TYPES.find(x=>x.id===profileForm.businessType)?.title||'POS'} workspace</button></footer></section></div>;}

  const restaurantTabs=[['sale','Order'],['orders','Open orders'],['menu','Menu'],['kitchen','Kitchen']];
  const garageTabs=[['sale','Checkout'],['jobs','Service jobs'],['stock','Parts stock']];
  const standardTabs=[['sale','Checkout'],['stock','Stock'],['sales','Sales']];
  const tabs=mode==='restaurant'?restaurantTabs:mode==='garage'?garageTabs:standardTabs;

  return <div className={`v5-page v5-pos v5-pos-${mode}`}>
    <section className="v5-hero panel v5-pos-hero"><div><p className="eyebrow">{modeMeta.title.toUpperCase()} POS</p><h2>{modeMeta.icon} Point of Sale</h2><p>{modeMeta.description}</p></div><div className="v5-action-row"><span className="v5-live-dot"><i/>Live · {location}</span><button className="button button-ghost" onClick={()=>{setProfileForm({...defaultProfile,...posProfile});setProfileEditor(true);}}>POS settings</button></div></section>
    <section className="v5-kpi-grid"><article className="panel"><span>Today</span><strong>{currency(todayRevenue,settings.currency)}</strong><small>{todaySales.length} sale(s)</small></article><article className="panel"><span>Cart</span><strong>{cart.reduce((s,x)=>s+safeNumber(x.qty),0)}</strong><small>{currency(totals.total,settings.currency)}</small></article>{mode==='restaurant'?<article className="panel"><span>Kitchen queue</span><strong>{openKitchenOrders.length}</strong><small>active tickets</small></article>:mode==='garage'?<article className="panel"><span>Open jobs</span><strong>{openJobs.length}</strong><small>work orders</small></article>:<article className="panel"><span>Low stock</span><strong>{products.filter(x=>productTracksStock(x)&&productStock(x)<=safeNumber(x.threshold??5)).length}</strong><small>items</small></article>}</section>
    <nav className="v5-segmented">{tabs.map(([id,label])=><button key={id} className={view===id?'active':''} onClick={()=>{if(id==='kitchen')onNavigate('kitchen');else if(id==='jobs')onNavigate('service-jobs');else setView(id);}}>{label}</button>)}</nav>

    {view==='sale'&&<section className="v5-pos-layout"><div className="panel v5-pos-catalog"><div className="v5-pos-toolbar"><div className="search-box">⌕<input placeholder={mode==='retail'?'Scan barcode / search SKU or product':'Search catalogue'} value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="ALL">All categories</option>{categories.map(x=><option key={x}>{x}</option>)}</select></div>
      {mode==='restaurant'&&<div className="v5-restaurant-context"><select value={diningOption} onChange={e=>setDiningOption(e.target.value)}><option>Dine in</option><option>Takeaway</option><option>Delivery</option></select>{diningOption==='Dine in'&&<select value={tableNumber} onChange={e=>setTableNumber(e.target.value)}><option value="">Select table</option>{Array.from({length:safeNumber(posProfile?.restaurantTables||12)},(_,i)=><option key={i+1}>{i+1}</option>)}</select>}</div>}
      <div className={mode==='wholesale'?'v5-wholesale-catalog':'v5-pos-catalog-grid'}>{catalogue.map((item)=>mode==='wholesale'?<button className="v5-wholesale-row" key={item.id} onClick={()=>chooseCatalogueItem(item)}><div><b>{item.name}</b><small>{item.sku||'No SKU'}</small></div><span>{productStock(item)} {item.unit||'pcs'}</span><strong>{currency(safeNumber(item.wholesalePrice)||safeNumber(item.price),settings.currency)}</strong><i>＋</i></button>:<button className={`v5-pos-tile ${item.trackStock!==false&&mode!=='restaurant'&&productStock(item)<=0?'out':''}`} key={item.id} disabled={mode!=='restaurant'&&productTracksStock(item)&&productStock(item)<=0} onClick={()=>chooseCatalogueItem(item)}><span>{(item.name||'I').slice(0,2).toUpperCase()}</span><div><b>{item.posName||item.name}</b><small>{mode==='restaurant'?item.category:(item.sku||item.category||'Item')}</small></div><strong>{currency(mode==='wholesale'?(safeNumber(item.wholesalePrice)||safeNumber(item.price)):item.price,settings.currency)}</strong>{mode!=='restaurant'&&item.trackStock!==false&&<em>{productStock(item)} left</em>}</button>)}</div></div>
      <aside className="panel v5-pos-cart"><header><div><p className="eyebrow">CURRENT SALE</p><h3>{activeRestaurantOrderId?'Open restaurant order':'New order'}</h3></div><button className="button button-ghost" disabled={!cart.length} onClick={()=>setCart([])}>Clear</button></header><div className="v5-pos-context-fields"><select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">{mode==='wholesale'?'Select customer':'Walk-in Customer'}</option>{customers.map(x=><option key={x.id} value={x.id}>{customerName(x)}</option>)}</select><select value={staffId} onChange={e=>setStaffId(e.target.value)}><option value="">POS operator</option>{employees.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={location} onChange={e=>setLocation(e.target.value)}>{locations.map(x=><option key={x}>{x}</option>)}</select></div>{mode==='garage'&&<div className="v5-garage-context"><input placeholder="Vehicle registration" value={vehicleRegistration} onChange={e=>setVehicleRegistration(e.target.value)}/><input placeholder="Make / model" value={vehicleMakeModel} onChange={e=>setVehicleMakeModel(e.target.value)}/><textarea rows="2" placeholder="Work requested / note" value={jobNote} onChange={e=>setJobNote(e.target.value)}/></div>}
      <div className="v5-cart-lines">{cart.map(item=><div className="v5-cart-line" key={item.key}><div><b>{item.name}</b>{item.modifiers?.length>0&&<small>{item.modifiers.map(x=>x.name).join(' · ')}</small>}<small>{currency(item.price,settings.currency)} each</small></div><div className="v5-qty"><button onClick={()=>setQty(item.key,item.qty-1)}>−</button><input type="number" min="0" value={item.qty} onChange={e=>setQty(item.key,e.target.value)}/><button onClick={()=>setQty(item.key,item.qty+1)}>＋</button></div><strong>{currency(item.price*item.qty,settings.currency)}</strong></div>)}{!cart.length&&<div className="v5-cart-empty">Tap an item to add it to the sale.</div>}</div>
      <div className="v5-pos-totals"><label><span>Discount %</span><input type="number" min="0" max="100" value={discountPercent} onChange={e=>setDiscountPercent(e.target.value)}/></label><label><span>GST %</span><input type="number" min="0" max="100" value={gstPercent} onChange={e=>setGstPercent(e.target.value)}/></label><div><span>Subtotal</span><b>{currency(totals.subtotal,settings.currency)}</b></div><div><span>Discount</span><b>− {currency(totals.discount,settings.currency)}</b></div><div><span>GST</span><b>{currency(totals.gst,settings.currency)}</b></div><div className="grand"><span>Total</span><strong>{currency(totals.total,settings.currency)}</strong></div></div>
      {mode==='restaurant'&&<button className="button button-secondary v5-full" disabled={!cart.length} onClick={sendKitchen}>Send to kitchen</button>}<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{paymentMethods.map(x=><option key={x}>{x}</option>)}</select>{paymentMethod==='Cash'&&<input type="number" min="0" step="0.01" placeholder="Cash received" value={cashReceived} onChange={e=>setCashReceived(e.target.value)}/>}<input placeholder="Payment reference (optional)" value={paymentReference} onChange={e=>setPaymentReference(e.target.value)}/><button className="button button-primary v5-checkout" disabled={!cart.length||busy} onClick={checkout}>{busy?'Processing…':`Charge ${currency(totals.total,settings.currency)}`}</button></aside></section>}

    {view==='orders'&&mode==='restaurant'&&<section className="v5-order-grid">{openKitchenOrders.map(order=><article className="panel v5-order-card" key={order.id}><header><div><b>{order.orderNumber}</b><small>{order.diningOption}{order.tableNumber?` · Table ${order.tableNumber}`:''}</small></div><span className="v5-pill">{order.status}</span></header><p>{(order.items||[]).map(x=>`${x.quantity||x.qty||1}× ${x.name}`).join(' · ')}</p><footer><strong>{currency(order.total,settings.currency)}</strong><button className="button button-primary" onClick={()=>loadRestaurantOrder(order)}>Load & pay</button></footer></article>)}</section>}

    {view==='menu'&&mode==='restaurant'&&<><section className="v5-hero panel compact"><div><p className="eyebrow">MENU MANAGER</p><h3>Restaurant menu & recipes</h3><p>Menu recipes deduct ingredient stock when the sale is paid.</p></div><button className="button button-primary" onClick={()=>openMenuEditor()}>＋ Menu item</button></section><section className="v5-card-grid">{menuItems.map(item=><article className="panel v5-data-card" key={item.id}><header><div className="v5-avatar">{item.name.slice(0,2).toUpperCase()}</div><div><h3>{item.name}</h3><p>{item.category}</p></div><strong>{currency(item.price,settings.currency)}</strong></header><div className="v5-detail-list"><span>Modifiers <b>{(item.modifiers||[]).length}</b></span><span>Recipe lines <b>{(item.recipe||[]).length}</b></span><span>Kitchen name <b>{item.kitchenName||item.name}</b></span></div><footer className="row-actions"><button onClick={()=>openMenuEditor(item)}>Edit</button></footer></article>)}</section></>}

    {view==='stock'&&<section className="panel"><div className="v5-section-heading"><div><p className="eyebrow">QUICK STOCK VIEW</p><h3>{mode==='garage'?'Parts inventory':'Inventory status'}</h3></div><button className="button button-primary" onClick={()=>onNavigate('products')}>Open full Inventory</button></div><div className="v5-table-wrap"><table><thead><tr><th>Item</th><th>SKU</th><th>Location</th><th>On hand</th><th>Low at</th></tr></thead><tbody>{products.filter(x=>x.trackStock!==false).map(x=><tr key={x.id}><td>{x.name}</td><td>{x.sku||'—'}</td><td>{x.location||'Main Location'}</td><td>{x.quantity}</td><td>{x.threshold??5}</td></tr>)}</tbody></table></div></section>}

    {view==='sales'&&<section className="panel"><div className="v5-section-heading"><div><p className="eyebrow">RECENT SALES</p><h3>POS transaction history</h3></div></div><div className="v5-table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Type</th><th>Total</th></tr></thead><tbody>{posSales.slice(0,25).map(x=><tr key={x.id}><td>{x.invoiceNumber||x.id}</td><td>{x.customerName||'Walk-in'}</td><td>{x.posType||x.source}</td><td>{currency(x.total,settings.currency)}</td></tr>)}</tbody></table></div></section>}

    <Modal open={Boolean(modifierItem)} title={modifierItem?`Customize ${modifierItem.name}`:'Customize item'} onClose={()=>setModifierItem(null)}><div className="v5-modifier-list">{(modifierItem?.modifiers||[]).map((mod)=><label key={mod.name}><input type="checkbox" checked={selectedModifiers.some(x=>x.name===mod.name)} onChange={e=>setSelectedModifiers(e.target.checked?[...selectedModifiers,mod]:selectedModifiers.filter(x=>x.name!==mod.name))}/><span>{mod.name}</span><b>{safeNumber(mod.price)>0?`+ ${currency(mod.price,settings.currency)}`:'Included'}</b></label>)}</div><footer className="modal-actions"><button className="button button-ghost" onClick={()=>setModifierItem(null)}>Cancel</button><button className="button button-primary" onClick={()=>{addMenuItem(modifierItem,selectedModifiers);setModifierItem(null);}}>Add to order</button></footer></Modal>

    <Modal open={Boolean(menuEditor)} title={menuEditor?.id?'Edit menu item':'Add menu item'} onClose={()=>setMenuEditor(null)}><div className="form-grid"><label className="wide"><span>Menu item name</span><input value={menuForm.name} onChange={e=>setMenuForm({...menuForm,name:e.target.value})}/></label><label><span>POS short name</span><input value={menuForm.posName} onChange={e=>setMenuForm({...menuForm,posName:e.target.value})}/></label><label><span>Kitchen name</span><input value={menuForm.kitchenName} onChange={e=>setMenuForm({...menuForm,kitchenName:e.target.value})}/></label><label><span>Category</span><input value={menuForm.category} onChange={e=>setMenuForm({...menuForm,category:e.target.value})}/></label><label><span>Price</span><input type="number" min="0" step="0.01" value={menuForm.price} onChange={e=>setMenuForm({...menuForm,price:e.target.value})}/></label><label className="wide"><span>Modifiers — one per line as Name|Price</span><textarea rows="4" placeholder={'Extra cheese|15\nNo onion|0\nLarge|25'} value={menuForm.modifiersText} onChange={e=>setMenuForm({...menuForm,modifiersText:e.target.value})}/></label></div><div className="v5-line-editor"><header><h4>Ingredient recipe</h4><button className="button button-ghost" onClick={()=>setMenuForm({...menuForm,recipe:[...(menuForm.recipe||[]),{productId:'',quantity:1}]})}>＋ Ingredient</button></header>{(menuForm.recipe||[]).map((row,i)=><div className="v5-line-row" key={i}><select value={row.productId} onChange={e=>setMenuForm({...menuForm,recipe:menuForm.recipe.map((x,index)=>index===i?{...x,productId:e.target.value}:x)})}><option value="">Select inventory ingredient</option>{products.filter(x=>x.itemType==='ingredient'||x.trackStock!==false).map(x=><option key={x.id} value={x.id}>{x.name} ({x.unit||'pcs'})</option>)}</select><input type="number" min="0" step="0.001" value={row.quantity} onChange={e=>setMenuForm({...menuForm,recipe:menuForm.recipe.map((x,index)=>index===i?{...x,quantity:e.target.value}:x)})}/><button className="button button-ghost" onClick={()=>setMenuForm({...menuForm,recipe:menuForm.recipe.filter((_,index)=>index!==i)})}>×</button></div>)}</div><footer className="modal-actions"><button className="button button-ghost" onClick={()=>setMenuEditor(null)}>Cancel</button><button className="button button-primary" onClick={saveMenu}>Save menu item</button></footer></Modal>

    <Modal open={Boolean(receipt)} title="Sale completed" onClose={()=>setReceipt(null)}><div className="v5-receipt-summary"><span>Invoice</span><strong>{receipt?.invoiceNumber}</strong><span>Total</span><strong>{currency(receipt?.total,settings.currency)}</strong><span>Payment</span><strong>{receipt?.paymentMethod}</strong>{receipt?.changeDue>0&&<><span>Change</span><strong>{currency(receipt.changeDue,settings.currency)}</strong></>}</div><footer className="modal-actions"><button className="button button-primary" onClick={()=>setReceipt(null)}>Done</button></footer></Modal>
  </div>;
}
