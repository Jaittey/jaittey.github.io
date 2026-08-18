(function(){
  let products=[],customers=[],cart=[];
  const el=s=>document.querySelector(s);
  async function init(){
    try{
      products=await SBDB.list('products');customers=await SBDB.list('customers');renderProducts();
      el('#posCustomer').innerHTML='<option value="">Walk-in Customer</option>'+customers.map(c=>`<option value="${c.id}">${SBUI.escape(c.name||c.customerName||'Customer')}</option>`).join('');
      el('#productSearch').oninput=renderProducts;el('#completeSale').onclick=checkout;
    }catch(e){SBUI.toast(e.message||'Could not load POS.','error')}
  }
  function renderProducts(){
    const q=(el('#productSearch').value||'').toLowerCase();
    const rows=products.filter(p=>!q||`${p.name||''} ${p.sku||''}`.toLowerCase().includes(q));
    el('#productGrid').innerHTML=rows.length?rows.map(p=>`<button class="product-tile" data-id="${p.id}"><strong>${SBUI.escape(p.name||'Product')}</strong><small>${SBUI.escape(p.sku||'No SKU')}</small><b>${SBUI.money(p.price)}</b><small>${Number(p.quantity||0)} in stock</small></button>`).join(''):'<div class="empty">No products found.</div>';
    el('#productGrid').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>add(products.find(p=>p.id===b.dataset.id)));
  }
  function add(p){if(!p)return;if(Number(p.quantity||0)<=0)return SBUI.toast('Out of stock','error');const c=cart.find(x=>x.id===p.id);if(c){if(c.qty>=Number(p.quantity||0))return SBUI.toast('Not enough stock','error');c.qty++}else cart.push({...p,qty:1});renderCart()}
  function renderCart(){
    const box=el('#cartList');
    box.innerHTML=cart.length
      ? cart.map(x=>`<div class="cart-row"><div><strong>${SBUI.escape(x.name||'Product')}</strong><small class="muted">${SBUI.money(x.price)}</small></div><div class="qty"><button data-minus="${x.id}">−</button><b>${x.qty}</b><button data-plus="${x.id}">+</button></div><strong>${SBUI.money(Number(x.price||0)*x.qty)}</strong></div>`).join('')
      : '<div class="empty">Cart is empty.</div>';
    box.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>change(b.dataset.minus,-1));
    box.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>change(b.dataset.plus,1));totals();
  }
  function change(id,d){const x=cart.find(i=>i.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)cart=cart.filter(i=>i.id!==id);else if(x.qty>Number(x.quantity||0))x.qty=Number(x.quantity||0);renderCart()}
  function calc(){const subtotal=cart.reduce((s,x)=>s+Number(x.price||0)*x.qty,0),disc=Number(el('#discount').value||0),gst=Number(el('#gst').value||0),discount=subtotal*disc/100,taxable=subtotal-discount,tax=taxable*gst/100;return{subtotal,discount,tax,total:taxable+tax}}
  function totals(){const t=calc();el('#subtotal').textContent=SBUI.money(t.subtotal);el('#discountValue').textContent='− '+SBUI.money(t.discount);el('#taxValue').textContent=SBUI.money(t.tax);el('#grandTotal').textContent=SBUI.money(t.total);if(el('#saleTotalHeader'))el('#saleTotalHeader').textContent=SBUI.money(t.total);el('#completeSale').disabled=!cart.length;el('#completeSale').textContent=`Complete Sale · ${SBUI.money(t.total)}`}
  async function checkout(){
    if(!cart.length)return;const t=calc(),customer=customers.find(c=>c.id===el('#posCustomer').value);
    const invoice={invoiceNumber:`POS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(Date.now()).slice(-5)}`,source:'POS',status:'PAID',customerId:customer?.id||'',customerName:customer?.name||customer?.customerName||'Walk-in Customer',items:cart.map(x=>({productId:x.id,name:x.name,quantity:x.qty,unitPrice:Number(x.price),amount:Number(x.price)*x.qty})),subtotal:t.subtotal,discount:t.discount,gst:t.tax,total:t.total,paymentMethod:el('#paymentMethod').value,date:new Date().toISOString().slice(0,10)};
    try{
      if(SBDB.isConfigured())await SBDB.rpc('sb_complete_pos_sale',{p_business_id:SBDB.requireBusiness(),p_invoice:invoice,p_payment:{amount:t.total,paymentMethod:el('#paymentMethod').value,paymentDate:invoice.date}});
      else{
        const iid=await SBDB.save('invoices',invoice);await SBDB.save('payments',{invoiceId:iid,invoiceNumber:invoice.invoiceNumber,amount:t.total,paymentMethod:invoice.paymentMethod,status:'PAID',date:invoice.date});
        for(const x of cart)await SBDB.save('products',{...x,quantity:Number(x.quantity||0)-x.qty},x.id);
      }
      SBUI.toast('Sale completed');cart=[];products=await SBDB.list('products');renderProducts();renderCart();await loadRecent();
    }catch(e){SBUI.toast(e.message||'Could not complete sale.','error')}
  }
  async function loadRecent(){
    try{
      const inv=(await SBDB.list('invoices')).filter(x=>x.source==='POS').slice(-8).reverse(),tbody=el('#recentPos tbody');
      tbody.innerHTML=inv.length?inv.map(x=>`<tr><td data-label="Sale">${SBUI.escape(x.invoiceNumber||x.id)}</td><td data-label="Customer">${SBUI.escape(x.customerName||'Walk-in Customer')}</td><td data-label="Payment">${SBUI.escape(x.paymentMethod||'')}</td><td data-label="Status"><span class="status paid">PAID</span></td><td data-label="Total">${SBUI.money(x.total)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No POS sales yet.</td></tr>';
    }catch(e){SBUI.toast(e.message||'Could not load recent sales.','error')}
  }
  window.addEventListener('DOMContentLoaded',()=>{el('#discount').oninput=totals;el('#gst').oninput=totals;init().then(()=>{renderCart();loadRecent()})});
})();
