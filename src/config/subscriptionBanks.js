export const DEFAULT_BANK_ACCOUNTS = {
  BML: { id:'BML', bankId:'BML', name:'Bank of Maldives', shortName:'BML', accountNumber:'7709516071101', accountName:'Ali Jailam', active:true },
  MIB: { id:'MIB', bankId:'MIB', name:'Maldives Islamic Bank', shortName:'MIB', accountNumber:'90103100571591000', accountName:'Ali Jailam', active:true },
};
export const normalizeAccount=(v='')=>String(v||'').replace(/\D/g,'');
export const normalizeReference=(v='')=>String(v||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
