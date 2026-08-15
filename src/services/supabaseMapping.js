const map = (row, keys = {}) => {
  if (!row) return null;
  const next = { ...row };
  Object.entries(keys).forEach(([snake, camel]) => {
    if (snake in next) {
      next[camel] = next[snake];
      delete next[snake];
    }
  });
  return next;
};

export const TABLE_ALIASES = {
  businesses: 'businesses',
  businessSubscriptions: 'business_subscriptions',
  subscriptionPayments: 'subscription_payments',
  platformUsers: 'platform_users',
  platformPlanSettings: 'platform_plan_settings',
  platformPaymentMethods: 'platform_payment_methods',
  platformBankAccounts: 'platform_bank_accounts',
};

export const ORDER_FIELD_ALIASES = {
  businesses: { createdAt: 'created_at', updatedAt: 'updated_at' },
  businessSubscriptions: { createdAt: 'created_at', updatedAt: 'updated_at', endsAt: 'ends_at' },
  subscriptionPayments: { createdAt: 'created_at', updatedAt: 'updated_at' },
  platformUsers: { lastLoginAt: 'last_login_at', createdAt: 'created_at', updatedAt: 'updated_at' },
  platformPlanSettings: { createdAt: 'created_at', updatedAt: 'updated_at' },
  platformPaymentMethods: { createdAt: 'created_at', updatedAt: 'updated_at' },
  platformBankAccounts: { createdAt: 'created_at', updatedAt: 'updated_at' },
};

const common = {
  created_at: 'createdAt',
  updated_at: 'updatedAt',
};

export function mapPlatformRow(alias, row) {
  if (!row) return row;

  if (alias === 'businesses') {
    return map(row, {
      ...common,
      legal_name: 'legalName',
      registration_number: 'registrationNumber',
      owner_id: 'ownerUid',
      owner_email: 'ownerEmail',
    });
  }

  if (alias === 'businessSubscriptions') {
    const mapped = map(row, {
      ...common,
      business_id: 'businessId',
      business_name: 'businessName',
      plan_id: 'planId',
      plan_name: 'planName',
      billing_period: 'billingPeriod',
      starts_at: 'startsAt',
      ends_at: 'endsAt',
      approved_at: 'approvedAt',
      approved_by: 'approvedBy',
      verification_notes: 'verificationNotes',
    });
    return { ...mapped, id: mapped.id || mapped.businessId };
  }

  if (alias === 'platformUsers') {
    return map(row, {
      ...common,
      display_name: 'displayName',
      photo_url: 'photoURL',
      is_super_admin: 'isSuperAdmin',
      last_login_at: 'lastLoginAt',
      status_updated_at: 'statusUpdatedAt',
      status_updated_by: 'statusUpdatedBy',
    });
  }

  if (alias === 'platformPlanSettings') {
    const mapped = map(row, {
      ...common,
      plan_id: 'planId',
      monthly_price: 'monthlyPrice',
      yearly_price: 'yearlyPrice',
      currency: 'currency',
      monthly_billing_cycle_days: 'monthlyBillingCycleDays',
      yearly_billing_cycle_days: 'yearlyBillingCycleDays',
    });
    return { ...mapped, id: mapped.planId };
  }

  if (alias === 'platformPaymentMethods') {
    return map(row, {
      ...common,
      account_label: 'accountLabel',
    });
  }

  if (alias === 'platformBankAccounts') {
    const mapped = map(row, {
      ...common,
      bank_id: 'bankId',
      short_name: 'shortName',
      account_number: 'accountNumber',
      account_name: 'accountName',
    });
    return { ...mapped, id: mapped.bankId || mapped.id };
  }

  if (alias === 'subscriptionPayments') {
    return mapSubscriptionRow(row);
  }

  return map(row, common);
}

export function mapMembershipRow(row) {
  if (!row) return row;
  return map(row, {
    ...common,
    business_id: 'businessId',
    business_name: 'businessName',
    user_id: 'userId',
    display_name: 'displayName',
    custom_permissions: 'customPermissions',
  });
}

export function mapSubscriptionRow(row) {
  if (!row) return row;
  return map(row, {
    ...common,
    request_id: 'requestId',
    business_id: 'businessId',
    business_name: 'businessName',
    plan_id: 'planId',
    plan_name: 'planName',
    billing_period: 'billingPeriod',
    payment_method_id: 'paymentMethodId',
    payment_method_name: 'paymentMethodName',
    payment_reference: 'paymentReference',
    bank_id: 'bankId',
    detected_bank_id: 'detectedBankId',
    bank_name: 'bankName',
    destination_account_number: 'destinationAccountNumber',
    destination_account_name: 'destinationAccountName',
    detected_amount: 'detectedAmount',
    detected_reference: 'detectedReference',
    normalized_reference: 'normalizedReference',
    detected_destination_account: 'detectedDestinationAccount',
    ocr_confidence: 'ocrConfidence',
    ocr_text: 'ocrText',
    receipt_file_hash: 'receiptFileHash',
    receipt_storage_path: 'receiptStoragePath',
    receipt_file_name: 'receiptFileName',
    receipt_file_type: 'receiptFileType',
    receipt_risk_level: 'receiptRiskLevel',
    receipt_warnings: 'receiptWarnings',
    auto_reject_reasons: 'autoRejectReasons',
    payer_name: 'payerName',
    payer_contact: 'payerContact',
    business_registration_number: 'businessRegistrationNumber',
    identity_reference: 'identityReference',
    verification_notes: 'verificationNotes',
    requester_id: 'requesterUid',
    requester_email: 'requesterEmail',
    requester_name: 'requesterName',
    verification_status: 'verificationStatus',
    submitted_at: 'submittedAt',
    approved_at: 'approvedAt',
    approved_by: 'approvedBy',
    reviewed_at: 'reviewedAt',
    reviewed_by: 'reviewedBy',
    review_message: 'reviewMessage',
    rejection_reason: 'rejectionReason',
    payment_status: 'paymentStatus',
    verified_at: 'verifiedAt',
    verified_by: 'verifiedBy',
  });
}
