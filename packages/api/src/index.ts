import { resolveApiBaseUrl, SESSION_HEADER } from '@hiraya/config';
import { emptyStore, type AuthSession, type EnrollmentApplyInput, type HirayaDatabase, type HirayaUser, type PublicSite } from '@hiraya/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

export type TokenStore = {
  getToken: () => string | null | Promise<string | null>;
  setToken?: (token: string | null) => void | Promise<void>;
};

export class HirayaApi {
  constructor(
    private readonly tokenStore: TokenStore,
    private readonly baseUrl = resolveApiBaseUrl(),
  ) {}

  private async headers(json = true): Promise<HeadersInit> {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = await this.tokenStore.getToken();
    if (token) headers[SESSION_HEADER] = token;
    return headers;
  }

  private async parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(
          res.ok ? 'The server returned an invalid response.' : `Request failed (${res.status})`,
          res.status,
        );
      }
    }
    if (!res.ok) {
      const fallback =
        res.status === 401
          ? 'Username or password is incorrect.'
          : res.status === 404
            ? 'The parent API route was not found. Confirm Hiraya.Api is running on port 5188.'
            : `Request failed (${res.status})`;
      const message = (data && (data.error || data.message || data.title)) || fallback;
      throw new ApiError(String(message), res.status, data);
    }
    return data as T;
  }

  private url(path: string): string {
    const base = (this.baseUrl || '').replace(/\/$/, '').replace(/\/api$/i, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  private parentItemUrl(parentId: string, extra = '') {
    return this.url(`/api/admin/parents/${encodeURIComponent(parentId)}${extra}`);
  }

  /** Session header only — never set Content-Type (needed for multipart uploads). */
  async authHeaders(): Promise<Record<string, string>> {
    return (await this.headers(false)) as Record<string, string>;
  }

  endpoint(path: string): string {
    return this.url(path);
  }

  async health(): Promise<{ status: string; hub?: string; database?: string; clients?: string[] }> {
    const res = await fetch(this.url('/api/health'));
    return this.parse(res);
  }

  async hub(): Promise<{ name: string; hub: string; sessionHeader: string; clients: string[] }> {
    const res = await fetch(this.url('/api/hub'));
    return this.parse(res);
  }

  async login(login: string, password: string): Promise<AuthSession> {
    await this.tokenStore.setToken?.(null);
    const res = await fetch(this.url('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
    });
    const session = await this.parse<AuthSession>(res);
    await this.tokenStore.setToken?.(session.token);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await fetch(this.url('/api/auth/logout'), {
        method: 'POST',
        headers: await this.headers(),
      });
    } finally {
      await this.tokenStore.setToken?.(null);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(this.url('/api/auth/password'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ userId, currentPassword, newPassword, confirmPassword: newPassword }),
    });
    await this.parse(res);
  }

  async saveProfile(input: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    username?: string;
    email: string;
    phone?: string;
    address?: string;
    position?: string;
  }): Promise<HirayaUser> {
    const headers = await this.headers();
    const body = JSON.stringify(input);
    let res = await fetch(this.url('/api/auth/profile'), { method: 'PUT', headers, body });
    if (res.status === 404 || res.status === 405) {
      res = await fetch(this.url('/api/parent/profile'), { method: 'PUT', headers, body });
    }
    if (res.status === 404 || res.status === 405) {
      res = await fetch(this.url('/api/auth/profile'), { method: 'POST', headers, body });
    }
    return this.parse<HirayaUser>(res);
  }

  async activate(token: string, password: string): Promise<unknown> {
    const res = await fetch(this.url('/api/auth/activate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    return this.parse(res);
  }

  async getStore(): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/store'), { headers: await this.headers(false) });
    const data = await this.parse<Partial<HirayaDatabase> | null>(res);
    return { ...emptyStore(), ...(data || {}) };
  }

  async putStore(db: HirayaDatabase): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/store'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(db),
    });
    if (res.status === 204) return this.getStore();
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ?? this.getStore();
  }

  async sendDirectMessage(toUserId: string, body: string): Promise<HirayaDatabase> {
    const payload = JSON.stringify({ toUserId, body });
    const headers = await this.headers();
    let res = await fetch(this.url('/api/messages'), { method: 'POST', headers, body: payload });
    if (res.status === 404) {
      res = await fetch(this.url('/api/direct-messages'), { method: 'POST', headers, body: payload });
    }
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ? { ...emptyStore(), ...saved } : this.getStore();
  }

  async approveEnrollment(applicationId: string, classId?: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/enrollment/applications/${applicationId}/approve`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ classId: classId || '' }),
    });
    return this.parse<HirayaDatabase>(res);
  }

  async rejectEnrollment(applicationId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/enrollment/applications/${applicationId}/reject`), {
      method: 'POST',
      headers: await this.headers(),
    });
    return this.parse<HirayaDatabase>(res);
  }

  async cancelEnrollment(applicationId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/enrollment/applications/${applicationId}/cancel`), {
      method: 'POST',
      headers: await this.headers(),
    });
    return this.parse<HirayaDatabase>(res);
  }

  async getPublicSite(): Promise<PublicSite> {
    const res = await fetch(this.url('/api/public/site'), { signal: AbortSignal.timeout(12000) });
    const data = await this.parse<PublicSite>(res);
    return {
      ...data,
      programs: data.programs || [],
      gallery: data.gallery || [],
    };
  }

  async saveStaff(input: {
    userId?: string;
    profileId?: string;
    fullname: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email: string;
    password?: string;
    confirmPassword?: string;
    phone?: string;
    address?: string;
    notes?: string;
    role: string;
    employeeCode?: string;
    position?: string;
    specialty?: string;
    bio?: string;
    status?: string;
    hireDate?: string;
  }): Promise<{ store: HirayaDatabase; userId: string }> {
    const res = await fetch(this.url('/api/staff'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(input),
    });
    const payload = await this.parse<{ userId?: string; UserId?: string } | null>(res);
    const store = await this.getStore();
    const email = input.email.trim().toLowerCase();
    const fromStore = (store.users || []).find((item) => (item.email || '').toLowerCase() === email)?.userId || '';
    const userId = payload?.userId || payload?.UserId || input.userId || fromStore;
    if (!userId) {
      throw new ApiError('Could not create the staff account. Confirm the HIRAYA API is running and try again.', res.status || 500, payload);
    }
    return { store, userId };
  }

  async uploadProfilePhoto(userId: string, file: Blob | { uri: string; name?: string; type?: string }, fileName = 'photo.jpg'): Promise<HirayaDatabase> {
    const headers = (await this.headers(false)) as Record<string, string>;
    const formBody = () => {
      const body = new FormData();
      if (file instanceof Blob) {
        body.append('file', file, fileName);
      } else {
        body.append('file', {
          uri: file.uri,
          name: file.name || fileName,
          type: file.type || 'image/jpeg',
        } as unknown as Blob);
      }
      return body;
    };
    const post = (path: string) => fetch(this.url(path), { method: 'POST', headers, body: formBody() });
    let res = await post(`/api/users/${encodeURIComponent(userId)}/photo`);
    if (res.status === 404) {
      res = await post(`/api/staff/${encodeURIComponent(userId)}/photo`);
    }
    await this.parse(res);
    return this.getStore();
  }

  async removeProfilePhoto(userId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/users/${encodeURIComponent(userId)}/photo`), {
      method: 'DELETE',
      headers: await this.headers(false),
    });
    await this.parse(res);
    return this.getStore();
  }

  profileMediaUrl(userId: string, version?: string | number | null): string {
    const stamp = version != null && String(version).trim() ? String(version) : String(Date.now());
    return `${this.url(`/api/media/profile/${encodeURIComponent(userId)}`)}?v=${encodeURIComponent(stamp)}`;
  }

  async setStaffActive(userId: string, active: boolean): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/staff/active'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ userId, active }),
    });
    await this.parse(res);
    return this.getStore();
  }

  async deleteStaff(userId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/staff/delete'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ userId }),
    });
    await this.parse(res);
    return this.getStore();
  }

  async createParent(input: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    notes?: string;
    password: string;
    confirmPassword: string;
    relationship?: string;
    studentId?: string;
  }): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/admin/parents'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify(input),
    });
    await this.parse(res);
    return this.getStore();
  }

  async updateParent(
    parentId: string,
    input: {
      firstName: string;
      middleName?: string;
      lastName: string;
      email: string;
      phone?: string;
      address?: string;
      notes?: string;
      password?: string;
      confirmPassword?: string;
    },
  ): Promise<HirayaDatabase> {
    if (!parentId) throw new ApiError('Parent account was not found.', 404);
    const payload = {
      ...input,
      password: input.password || undefined,
      confirmPassword: input.confirmPassword || undefined,
    };
    const headers = await this.headers();
    const body = JSON.stringify(payload);
    let res = await fetch(this.parentItemUrl(parentId), { method: 'PUT', headers, body });
    if (res.status === 404 || res.status === 405) {
      res = await fetch(this.parentItemUrl(parentId, '/update'), { method: 'POST', headers, body });
    }
    if (res.status === 404 || res.status === 405) {
      return this.updateParentInStore(parentId, payload);
    }
    if (res.status === 204) return this.getStore();
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ?? this.getStore();
  }

  private async updateParentInStore(
    parentId: string,
    input: {
      firstName: string;
      middleName?: string;
      lastName: string;
      email: string;
      phone?: string;
      address?: string;
      notes?: string;
    },
  ): Promise<HirayaDatabase> {
    const store = await this.getStore();
    const current = store.users.find((item) => item.userId === parentId && item.role === 'parent');
    if (!current) throw new ApiError('Parent account was not found.', 404);
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const middleName = (input.middleName || '').trim();
    return this.putStore({
      ...store,
      users: store.users.map((item) =>
        item.userId === parentId
          ? {
              ...item,
              firstName,
              middleName,
              lastName,
              fullname: [firstName, middleName, lastName].filter(Boolean).join(' '),
              email: input.email.trim(),
              phone: input.phone || '',
              address: input.address || '',
              notes: input.notes || item.notes || '',
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
  }

  async setParentActive(parentId: string, active: boolean): Promise<HirayaDatabase> {
    const res = await fetch(this.parentItemUrl(parentId, '/active'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ active }),
    });
    if (res.status === 204) return this.getStore();
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ?? this.getStore();
  }

  async deleteParent(parentId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.parentItemUrl(parentId), {
      method: 'DELETE',
      headers: await this.headers(false),
    });
    if (res.status === 204) return this.getStore();
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ?? this.getStore();
  }

  async assignParentChild(parentId: string, studentId: string, relationship = 'Guardian'): Promise<HirayaDatabase> {
    const res = await fetch(this.parentItemUrl(parentId, '/children'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ studentId, relationship }),
    });
    await this.parse(res);
    return this.getStore();
  }

  async removeParentChild(parentId: string, studentId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.parentItemUrl(parentId, `/children/${encodeURIComponent(studentId)}`), {
      method: 'DELETE',
      headers: await this.headers(false),
    });
    await this.parse(res);
    return this.getStore();
  }

  async me(): Promise<HirayaUser> {
    const res = await fetch(this.url('/api/auth/me'), {
      headers: await this.headers(false),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(6000) : undefined,
    });
    return this.parse<HirayaUser>(res);
  }

  async applyEnrollment(input: EnrollmentApplyInput): Promise<{ submitted?: boolean; applicationId?: string }> {
    const res = await fetch(this.url('/api/public/enrollment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(20000) : undefined,
    });
    return this.parse(res);
  }

  async parentProfile(): Promise<HirayaUser> {
    const res = await fetch(this.url('/api/parent/profile'), { headers: await this.headers(false) });
    return this.parse(res);
  }

  async parentChildren(): Promise<unknown> {
    const res = await fetch(this.url('/api/parent/children'), { headers: await this.headers(false) });
    return this.parse(res);
  }

  async parentChildDetail(studentId: string, resource?: string): Promise<unknown> {
    const suffix = resource ? `/${resource}` : '';
    const res = await fetch(this.url(`/api/parent/children/${studentId}${suffix}`), {
      headers: await this.headers(false),
    });
    return this.parse(res);
  }

  async getModules(): Promise<unknown> {
    const res = await fetch(this.url('/api/modules'), { headers: await this.headers(false) });
    return this.parse(res);
  }

  async saveWebsiteLanding(welcomeTitle: string, welcomeMessage: string): Promise<void> {
    const res = await fetch(this.url('/api/admin/website/landing'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify({ welcomeTitle, welcomeMessage }),
    });
    await this.parse(res);
  }

  async saveWebsiteAbout(input: {
    aboutTitle: string;
    description: string;
    mission: string;
    vision: string;
    values: string;
  }): Promise<void> {
    const res = await fetch(this.url('/api/admin/website/about'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(input),
    });
    await this.parse(res);
  }
}

export function createHirayaApi(tokenStore: TokenStore, baseUrl?: string): HirayaApi {
  return new HirayaApi(tokenStore, baseUrl !== undefined ? resolveApiBaseUrl(baseUrl) : resolveApiBaseUrl());
}
