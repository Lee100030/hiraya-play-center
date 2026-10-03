import type { HirayaDatabase, HirayaUser, Payment } from '@hiraya/types';
import { isTeacherPayment } from './paymentLanes';

function sameId(left?: string, right?: string) {
  return (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase();
}

function loginLocal(email?: string) {
  const value = (email || '').trim().toLowerCase();
  const at = value.indexOf('@');
  return at > 0 ? value.slice(0, at) : '';
}

/** Drop a personal email from every account except the person it actually belongs to. */
function clearSharedPersonalEmails(users: HirayaUser[]): { users: HirayaUser[]; changed: boolean } {
  const grouped = new Map<string, HirayaUser[]>();
  for (const user of users) {
    const email = (user.personalEmail || '').trim().toLowerCase();
    if (!email) continue;
    const list = grouped.get(email) || [];
    list.push(user);
    grouped.set(email, list);
  }
  const drop = new Set<string>();
  for (const [email, owners] of grouped) {
    const loginOwner = users.find((user) => (user.email || '').trim().toLowerCase() === email);
    let keeper = loginOwner?.userId || '';
    if (!keeper && owners.length > 1) {
      const local = email.split('@')[0] || '';
      const match = owners.find((user) => {
        const login = loginLocal(user.email);
        return login.length >= 4 && (local.startsWith(login) || login.startsWith(local));
      });
      keeper = match?.userId || '';
    } else if (!keeper) {
      continue;
    }
    for (const user of owners) {
      if (!sameId(user.userId, keeper)) drop.add(user.userId);
    }
  }
  if (!drop.size) return { users, changed: false };
  return {
    changed: true,
    users: users.map((user) => (drop.has(user.userId) ? { ...user, personalEmail: '' } : user)),
  };
}

function digitNote(value?: string) {
  return /^\d{2,8}$/.test((value || '').trim());
}

function mashedAccount(value?: string) {
  const text = (value || '').trim();
  if (!/^\d{6,}$/.test(text)) return false;
  if (/^(\d)\1{5,}$/.test(text)) return true;
  return /^(?:23)+2?$/.test(text);
}

function clearTestPayment(row: Payment): Payment | null {
  let next = row;
  let changed = false;
  if (digitNote(row.notes)) {
    next = { ...next, notes: '' };
    changed = true;
  }
  if (mashedAccount(row.fromAccountNumber)) {
    next = { ...next, fromAccountNumber: '' };
    changed = true;
  }
  if (mashedAccount(row.accountNumber)) {
    next = { ...next, accountNumber: '' };
    changed = true;
  }
  const paid = Number(row.amountPaid || 0);
  const amount = Number(row.amount || 0);
  if (isTeacherPayment(row) && paid === 1 && amount >= 100 && digitNote(row.notes)) {
    const status = (row.paymentStatus || '').toLowerCase() === 'paid' ? 'pending' : row.paymentStatus;
    next = { ...next, amountPaid: 0, paymentStatus: status || 'pending' };
    changed = true;
  }
  return changed ? next : null;
}

/** Returns a store copy when leftover test payment data was removed, otherwise null. */
export function scrubLeftoverPaymentData(store: HirayaDatabase): HirayaDatabase | null {
  const mail = clearSharedPersonalEmails(store.users || []);
  let paymentsChanged = false;
  const payments = (store.payments || []).map((row) => {
    const next = clearTestPayment(row);
    if (!next) return row;
    paymentsChanged = true;
    return next;
  });
  if (!mail.changed && !paymentsChanged) return null;
  return {
    ...store,
    users: mail.users,
    payments,
  };
}
