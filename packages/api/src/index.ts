import { resolveApiBaseUrl, SESSION_HEADER } from '@hiraya/config';
import type {
  AuthSession,
  EnrollmentApplyInput,
  HirayaDatabase,
  HirayaUser,
  PublicSite,
} from '@hiraya/types';

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
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message =
        (data && (data.error || data.message || data.title)) || `Request failed (${res.status})`;
      throw new ApiError(String(message), res.status, data);
    }
    return data as T;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async health(): Promise<unknown> {
    const res = await fetch(this.url('/api/health'));
    return this.parse(res);
  }

  async login(login: string, password: string): Promise<AuthSession> {
    const res = await fetch(this.url('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
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
      body: JSON.stringify({ userId, currentPassword, newPassword }),
    });
    await this.parse(res);
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
    return this.parse<HirayaDatabase>(res);
  }

  async putStore(db: HirayaDatabase): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/store'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(db),
    });
    return this.parse<HirayaDatabase>(res);
  }

  async getPublicSite(): Promise<PublicSite> {
    const res = await fetch(this.url('/api/public/site'));
    const data = await this.parse<PublicSite>(res);
    return {
      ...data,
      programs: data.programs || [],
      gallery: data.gallery || [],
    };
  }

  async applyEnrollment(input: EnrollmentApplyInput): Promise<unknown> {
    const res = await fetch(this.url('/api/public/enrollment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
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
}

export function createHirayaApi(tokenStore: TokenStore, baseUrl?: string): HirayaApi {
  return new HirayaApi(tokenStore, baseUrl ? resolveApiBaseUrl(baseUrl) : resolveApiBaseUrl());
}
