import { supabase } from '../config/supabase';
import { requireActiveBusinessId } from './tenantContext';

const throwIfError = (error, fallback) => {
  if (error) throw new Error(error.message || fallback);
};

export async function completePosSaleV5(invoice, payment) {
  const { data, error } = await supabase.rpc('sb_complete_pos_sale_v5', {
    p_business_id: requireActiveBusinessId(),
    p_invoice: invoice,
    p_payment: payment,
  });
  throwIfError(error, 'Could not complete the POS sale.');
  return data;
}

export async function adjustStockV5(productId, delta, reason = 'Manual adjustment', note = '') {
  const { data, error } = await supabase.rpc('sb_adjust_stock_v5', {
    p_business_id: requireActiveBusinessId(),
    p_product_id: productId,
    p_delta: Number(delta || 0),
    p_reason: reason,
    p_note: note,
  });
  throwIfError(error, 'Could not update stock.');
  return Number(data || 0);
}

export async function receivePurchaseOrderV5(purchaseOrderId, receipt = [], note = '') {
  const { data, error } = await supabase.rpc('sb_receive_purchase_order_v5', {
    p_business_id: requireActiveBusinessId(),
    p_purchase_order_id: purchaseOrderId,
    p_receipt: receipt,
    p_note: note,
  });
  throwIfError(error, 'Could not receive this purchase order.');
  return data;
}

export async function fulfillMarketplaceOrderV5(orderId) {
  const { data, error } = await supabase.rpc('sb_fulfill_marketplace_order_v5', {
    p_business_id: requireActiveBusinessId(),
    p_order_id: orderId,
  });
  throwIfError(error, 'Could not fulfill this marketplace order.');
  return data;
}
