import { createWorker } from 'tesseract.js';

const numeric = (value = '') => Number(String(value || '').replace(/,/g, ''));

export async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function extractAmount(text = '', expectedAmount = 0) {
  const source = String(text || '');
  const preferred = [
    /(?:AMOUNT|TRANSFER(?:RED)?|TOTAL|PAID)\s*[:\-]?\s*-?\s*(?:MVR\s*)?([0-9,]+\.\d{2})/i,
    /-?\s*MVR\s*([0-9,]+\.\d{2})/i,
    /([0-9,]+\.\d{2})\s*MVR/i,
  ];
  for (const pattern of preferred) {
    const match = source.match(pattern);
    if (match) return numeric(match[1]);
  }

  const candidates = [...source.matchAll(/(?:MVR\s*)?([0-9]{1,3}(?:,[0-9]{3})*\.\d{2}|[0-9]+\.\d{2})\s*(?:MVR)?/gi)]
    .map((match) => numeric(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!candidates.length) return 0;
  if (Number(expectedAmount) > 0) {
    const exact = candidates.find((value) => Math.abs(value - Number(expectedAmount)) <= 0.01);
    if (exact) return exact;
    return [...candidates].sort((a, b) => Math.abs(a - expectedAmount) - Math.abs(b - expectedAmount))[0];
  }
  return Math.max(...candidates);
}

export async function analyzeReceiptImage(file, {
  expectedAmount = 0,
  onProgress = () => {},
} = {}) {
  if (!file) throw new Error('Upload a transfer slip image.');
  if (!file.type.startsWith('image/')) throw new Error('Transfer slip must be an image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Transfer slip image must be smaller than 8 MB.');

  const fileHash = await sha256File(file);
  let text = '';
  let confidence = 0;
  const issues = [];

  try {
    const worker = await createWorker('eng', 1, {
      logger: (message) => {
        if (message?.status === 'recognizing text') {
          onProgress(Math.round((message.progress || 0) * 100));
        }
      },
    });
    try {
      const result = await worker.recognize(file);
      text = result?.data?.text || '';
      confidence = Number(result?.data?.confidence || 0);
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    issues.push('The slip could not be read automatically. Super Admin must check the image manually.');
  }

  const amount = extractAmount(text, expectedAmount);
  if (!amount) {
    issues.push('Transferred amount could not be detected automatically.');
  } else if (Number(expectedAmount) > 0 && Math.abs(amount - Number(expectedAmount)) > 0.01) {
    issues.push(`Detected amount MVR ${amount.toFixed(2)} differs from expected MVR ${Number(expectedAmount).toFixed(2)}.`);
  }
  if (confidence > 0 && confidence < 40) {
    issues.push('OCR confidence is low; manual amount verification is recommended.');
  }

  return {
    text: String(text).replace(/\s+/g, ' ').trim(),
    ocrConfidence: confidence,
    amount,
    fileHash,
    issues,
    warnings: issues,
    reasons: [],
    riskLevel: issues.length ? 'REVIEW' : 'LOW',
    automaticallyRejected: false,
    bankId: '',
    reference: '',
    destinationAccount: '',
  };
}
