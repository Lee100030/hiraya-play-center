export type SalaryNoticeCopy = {
  status: string;
  subjectPhrase: string;
  headline: string;
  intro: string;
  notifyTitle: string;
};

export function deriveSalaryStatus(amount: number, paid: number, stored?: string) {
  const status = (stored || '').trim().toLowerCase();
  if (['failed', 'refunded', 'cancelled', 'canceled', 'void', 'rejected', 'waived'].includes(status)) {
    return status === 'canceled' || status === 'void' ? 'cancelled' : status;
  }
  if (amount > 0 && paid > 0 && paid + 0.009 >= amount) return 'paid';
  if (paid > 0 && paid + 0.009 < amount) return 'partial';
  if (status === 'overdue') return 'overdue';
  return 'pending';
}

export function describeSalaryNotice(
  teacherName: string,
  date: string,
  amountLabel: string,
  paidLabel: string,
  owedLabel: string,
  amount: number,
  paid: number,
  stored?: string,
  extra = '',
): SalaryNoticeCopy {
  const status = deriveSalaryStatus(amount, paid, stored);
  const name = (teacherName || '').trim() || 'there';
  const when = (date || '').trim() || 'Not provided';
  const tail = extra.trim() ? ` ${extra.trim()}` : '';
  if (status === 'paid') {
    return {
      status,
      subjectPhrase: 'Your salary is on your account',
      headline: 'Your salary is on your account',
      intro: `Good day, ${name}. Your salary of ${amountLabel} for ${when} is now on your Hiraya account.${tail}`,
      notifyTitle: 'Salary on your account',
    };
  }
  if (status === 'partial') {
    return {
      status,
      subjectPhrase: "You've received a partial salary payment",
      headline: "You've received a partial salary payment",
      intro: `Good day, ${name}. A partial salary payment of ${paidLabel} was recorded for ${when}. The full amount is ${amountLabel}, and ${owedLabel} is still owed.${tail}`,
      notifyTitle: 'Partial salary payment',
    };
  }
  if (status === 'overdue') {
    return {
      status,
      subjectPhrase: 'Your salary payment is overdue',
      headline: 'Your salary payment is overdue',
      intro: `Good day, ${name}. Your salary of ${amountLabel} for ${when} is overdue. ${owedLabel} is still owed.${tail}`,
      notifyTitle: 'Salary payment overdue',
    };
  }
  if (status === 'failed' || status === 'rejected') {
    return {
      status,
      subjectPhrase: 'Your salary payment did not go through',
      headline: 'Your salary payment did not go through',
      intro: `Good day, ${name}. The salary payment of ${amountLabel} for ${when} did not go through. ${owedLabel} is still owed.${tail}`,
      notifyTitle: 'Salary payment failed',
    };
  }
  if (status === 'refunded') {
    return {
      status,
      subjectPhrase: 'Your salary payment was refunded',
      headline: 'Your salary payment was refunded',
      intro: `Good day, ${name}. The salary payment of ${amountLabel} for ${when} was refunded.${tail}`,
      notifyTitle: 'Salary payment refunded',
    };
  }
  if (status === 'cancelled' || status === 'waived') {
    return {
      status,
      subjectPhrase: 'Your salary payment was cancelled',
      headline: 'Your salary payment was cancelled',
      intro: `Good day, ${name}. The salary payment of ${amountLabel} for ${when} was cancelled. It is not on your account.${tail}`,
      notifyTitle: 'Salary payment cancelled',
    };
  }
  return {
    status,
    subjectPhrase: 'Your salary payment is being processed',
    headline: 'Your salary payment is being processed',
    intro: `Good day, ${name}. Your salary of ${amountLabel} for ${when} is being processed. No amount has been released yet.${tail}`,
    notifyTitle: 'Salary payment processing',
  };
}
