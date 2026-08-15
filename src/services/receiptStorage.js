import { supabase } from '../config/supabase';

export async function uploadSubscriptionReceipt(file, businessId) {
  if (!businessId) throw new Error('Business is required.');
  if (!file) throw new Error('Receipt image is required.');

  const safeName = String(file.name || 'receipt.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${businessId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from('subscription-receipts')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
  if (error) throw new Error(error.message || 'Could not upload subscription receipt.');

  return { storagePath: path };
}

export async function getSubscriptionReceiptSignedUrl(storagePath, expiresIn = 900) {
  if (!storagePath) return '';
  const { data, error } = await supabase.storage
    .from('subscription-receipts')
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw new Error(error.message || 'Could not open subscription receipt.');
  return data?.signedUrl || '';
}
