const BLOCKED_DOMAIN = /\.(local|invalid|test|example)$/i;

export function personalEmailError(raw: string): string | null {
  const email = (raw || '').trim();
  if (!email) return 'Enter a personal email. The Hiraya account address is only for sign-in.';
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at >= email.length - 1 || /\s/.test(email)) {
    return 'Enter a valid personal email, for example name@gmail.com.';
  }
  const domain = email.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return 'Enter a valid personal email, for example name@gmail.com.';
  }
  if (BLOCKED_DOMAIN.test(domain) || domain.toLowerCase() === 'localhost') {
    return 'That address cannot receive mail. Enter their personal email, such as a Gmail address. Hiraya sends the message from its own mailbox.';
  }
  return null;
}

export function normalizePersonalEmail(raw: string): string {
  const error = personalEmailError(raw);
  if (error) throw new Error(error);
  return raw.trim().toLowerCase();
}

type MailUser = {
  userId?: string;
  email?: string;
  personalEmail?: string;
  fullname?: string;
  firstName?: string;
  lastName?: string;
};

function mailName(user?: MailUser | null) {
  if (!user) return 'this person';
  const parts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return parts || (user.fullname || '').trim() || (user.email || '').trim() || 'this person';
}

function sameId(left?: string, right?: string) {
  return (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase();
}

/** Another account already uses this address as a sign-in or personal email. */
export function personalEmailOwnerError(users: MailUser[], userId: string, raw: string): string | null {
  const owner = users.find((user) => sameId(user.userId, userId));
  if (!owner) return 'This payment is not linked to a person, so their email cannot be used.';
  const email = (raw || '').trim().toLowerCase();
  if (!email) return null;
  const other = users.find((user) => {
    if (sameId(user.userId, owner.userId)) return false;
    return (user.personalEmail || '').trim().toLowerCase() === email || (user.email || '').trim().toLowerCase() === email;
  });
  if (!other) return null;
  return `That email belongs to ${mailName(other)}, not ${mailName(owner)}. It was not loaded. Enter ${mailName(owner)}'s own email.`;
}

/** Email stored on this person, or a blank field plus an error when it also belongs to someone else. */
export function ownedPersonalEmail(users: MailUser[], userId: string): { email: string; error: string | null } {
  const owner = users.find((user) => sameId(user.userId, userId));
  if (!owner) {
    return { email: '', error: 'This payment is not linked to a person, so their email was not loaded.' };
  }
  const email = (owner.personalEmail || '').trim();
  const error = personalEmailOwnerError(users, owner.userId || userId, email);
  if (error) return { email: '', error };
  return { email, error: null };
}
