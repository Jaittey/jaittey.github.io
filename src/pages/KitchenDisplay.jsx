import { useMemo, useState } from 'react';
import { saveRecord } from '../services/database';

const STATUSES = ['NEW', 'PREPARING', 'READY', 'SERVED'];

const ageMinutes = (value) => {
  const time = new Date(value || Date.now()).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 60000));
};

export default function KitchenDisplay({ orders = [], notify = () => {} }) {
  const [filter, setFilter] = useState('ACTIVE');
  const visible = useMemo(() => orders
    .filter((order) => {
      const status = String(order.status || 'NEW').toUpperCase();
      if (filter === 'ACTIVE') return ['NEW', 'PREPARING', 'READY'].includes(status);
      return status === filter;
    })
    .sort((a, b) => new Date(a.createdAt || a.orderTime || 0) - new Date(b.createdAt || b.orderTime || 0)), [orders, filter]);

  const setStatus = async (order, status) => {
    await saveRecord('restaurantOrders', {
      status,
      [`${status.toLowerCase()}At`]: new Date().toISOString(),
    }, order.id);
    notify(`Order ${order.orderNumber || order.id} marked ${status}.`);
  };

  return <div className="v5-page v5-kds-page">
    <section className="v5-hero panel"><div><p className="eyebrow">RESTAURANT OPERATIONS</p><h2>Kitchen Display</h2><p>Orders move from the POS to preparation, ready and served without paper tickets.</p></div><div className="v5-live-dot"><i/>Live kitchen queue</div></section>
    <nav className="v5-segmented">{['ACTIVE', ...STATUSES].map((status)=><button key={status} className={filter===status?'active':''} onClick={()=>setFilter(status)}>{status}</button>)}</nav>
    <section className="v5-kds-grid">{visible.map((order)=>{const status=String(order.status||'NEW').toUpperCase();const age=ageMinutes(order.createdAt||order.orderTime);return <article className={`panel v5-kds-ticket status-${status.toLowerCase()}`} key={order.id}><header><div><strong>{order.orderNumber||`#${String(order.id).slice(-6)}`}</strong><small>{order.diningOption||'Dine in'}{order.tableNumber?` · Table ${order.tableNumber}`:''}</small></div><span>{age}m</span></header><div className="v5-kds-items">{(order.items||[]).map((item,index)=><div key={`${item.name}-${index}`}><b>{item.quantity||item.qty||1}× {item.name}</b>{(item.modifiers||[]).length>0&&<small>{item.modifiers.map(x=>x.name||x).join(' · ')}</small>}{item.note&&<small>{item.note}</small>}</div>)}</div><footer><span className="v5-pill">{status}</span><div className="row-actions">{status==='NEW'&&<button onClick={()=>setStatus(order,'PREPARING')}>Start</button>}{status==='PREPARING'&&<button onClick={()=>setStatus(order,'READY')}>Ready</button>}{status==='READY'&&<button onClick={()=>setStatus(order,'SERVED')}>Served</button>}{status==='SERVED'&&<button onClick={()=>setStatus(order,'NEW')}>Reopen</button>}</div></footer></article>;})}</section>
    {!visible.length&&<section className="panel v5-empty"><strong>No kitchen tickets</strong><p>Restaurant POS orders will appear here after they are sent to the kitchen.</p></section>}
  </div>;
}
