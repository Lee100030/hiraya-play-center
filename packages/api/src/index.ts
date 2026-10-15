import { resolveApiBaseUrl, SESSION_HEADER } from '@hiraya/config';
import { emptyStore, type AuthSession, type EnrollmentApplyInput, type HirayaDatabase, type HirayaUser, type PublicSite, type TeacherApplyInput } from '@hiraya/types';
import { approvedTeacherApplicationsWithoutAccount, diffStore, teacherHireDraft } from '@hiraya/utils';

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
  private cachedToken = '';

  constructor(
    private readonly tokenStore: TokenStore,
    private readonly baseUrl = resolveApiBaseUrl(),
  ) {}

  private async headers(json = true): Promise<HeadersInit> {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = await this.tokenStore.getToken();
    if (typeof token === 'string' && token) this.cachedToken = token;
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

  async login(login: string, password: string, client?: string): Promise<AuthSession> {
    await this.tokenStore.setToken?.(null);
    const res = await fetch(this.url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(client ? { 'X-Hiraya-Client': client } : {}),
      },
      body: JSON.stringify({ login, password, ...(client ? { client } : {}) }),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(60000) : undefined,
    });
    const session = await this.parse<AuthSession>(res);
    await this.tokenStore.setToken?.(session.token);
    if (session.token) this.cachedToken = session.token;
    return session;
  }

  async logout(): Promise<void> {
    try {
      const signal =
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(4000)
          : undefined;
      await fetch(this.url('/api/auth/logout'), {
        method: 'POST',
        headers: await this.headers(),
        signal,
      });
    } catch {
      /* Local sign-out still proceeds if the API is offline. */
    } finally {
      await this.tokenStore.setToken?.(null);
      this.cachedToken = '';
    }
  }

  async requestPasswordCode(currentPassword: string): Promise<{ sent: boolean; to?: string }> {
    const res = await fetch(this.url('/api/auth/password/request-code'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ currentPassword }),
    });
    return this.parse(res);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    extra?: { verificationCode?: string; adminPassword?: string; confirmPassword?: string },
  ): Promise<void> {
    const res = await fetch(this.url('/api/auth/password'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        userId,
        currentPassword,
        newPassword,
        confirmPassword: extra?.confirmPassword || newPassword,
        verificationCode: extra?.verificationCode || '',
        adminPassword: extra?.adminPassword || '',
      }),
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

  async activate(token: string, password: string, confirmPassword?: string): Promise<unknown> {
    const confirm = (confirmPassword || password || '').trim();
    const res = await fetch(this.url('/api/auth/activate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, confirmPassword: confirm }),
    });
    return this.parse(res);
  }

  async getStore(): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/store'), { headers: await this.headers(false) });
    const data = await this.parse<Partial<HirayaDatabase> | null>(res);
    return { ...emptyStore(), ...(data || {}) };
  }

  async saveChanges(base: HirayaDatabase, next: HirayaDatabase): Promise<HirayaDatabase> {
    const patch = diffStore(base as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
    if (patch.collections.length === 0) return base;
    const res = await fetch(this.url('/api/store/patch'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify(patch),
    });
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ? { ...emptyStore(), ...saved } : this.getStore();
  }

  async putStore(db: HirayaDatabase, base?: HirayaDatabase): Promise<HirayaDatabase> {
    if (base) return this.saveChanges(base, db);
    const res = await fetch(this.url('/api/store'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(db),
    });
    if (res.status === 204) return this.getStore();
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ?? this.getStore();
  }

  async sendDirectMessage(toUserId: string, body: string, groupId = ''): Promise<HirayaDatabase> {
    const payload = JSON.stringify({ toUserId, groupId, body });
    const headers = await this.headers();
    let res = await fetch(this.url('/api/messages'), { method: 'POST', headers, body: payload });
    if (res.status === 404) {
      res = await fetch(this.url('/api/direct-messages'), { method: 'POST', headers, body: payload });
    }
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ? { ...emptyStore(), ...saved } : this.getStore();
  }

  async deleteDirectMessage(alertId: string): Promise<HirayaDatabase> {
    const id = encodeURIComponent((alertId || '').trim());
    const headers = await this.headers();
    let res = await fetch(this.url(`/api/messages/${id}`), { method: 'DELETE', headers });
    if (res.status === 404) {
      res = await fetch(this.url(`/api/direct-messages/${id}`), { method: 'DELETE', headers });
    }
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ? { ...emptyStore(), ...saved } : this.getStore();
  }

  async createChatGroup(name: string, memberIds: string[]): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/chat-groups'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ name, memberIds }),
    });
    const saved = await this.parse<HirayaDatabase | undefined>(res);
    return saved ? { ...emptyStore(), ...saved } : this.getStore();
  }

  async scheduleTeacherInterview(applicationId: string, when: string, place: string, instructions?: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/enrollment/applications/${applicationId}/interview`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ when, place, instructions: instructions || '' }),
    });
    return this.parse<HirayaDatabase>(res);
  }

  async approveEnrollment(applicationId: string, classId?: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/enrollment/applications/${applicationId}/approve`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ classId: classId || '' }),
    });
    return this.parse<HirayaDatabase>(res);
  }

  async importApprovedTeachers(): Promise<HirayaDatabase> {
    const res = await fetch(this.url('/api/enrollment/teachers/import'), {
      method: 'POST',
      headers: await this.headers(),
    });
    if (res.status === 404) return this.importApprovedTeachersViaStaff();
    return this.parse<HirayaDatabase>(res);
  }

  private async importApprovedTeachersViaStaff(): Promise<HirayaDatabase> {
    let store = await this.getStore();
    const missing = approvedTeacherApplicationsWithoutAccount(store);
    for (const app of missing) {
      const password = `Hk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      const saved = await this.saveStaff(teacherHireDraft(store, app, password));
      store = saved.store;
    }
    return store;
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
    personalEmail?: string;
    password?: string;
    confirmPassword?: string;
    adminPassword?: string;
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

  studentPhotoUrl(studentId: string, version?: string | number | null): string {
    return this.profileMediaUrl(studentId, version);
  }

  async uploadStudentPhoto(studentId: string, file: Blob, fileName = 'photo.jpg'): Promise<HirayaDatabase> {
    const headers = (await this.headers(false)) as Record<string, string>;
    const body = new FormData();
    body.append('file', file, fileName);
    const res = await fetch(this.url(`/api/students/${encodeURIComponent(studentId)}/photo`), {
      method: 'POST',
      headers,
      body,
    });
    await this.parse(res);
    return this.getStore();
  }

  async removeStudentPhoto(studentId: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/students/${encodeURIComponent(studentId)}/photo`), {
      method: 'DELETE',
      headers: await this.headers(false),
    });
    await this.parse(res);
    return this.getStore();
  }

  profileMediaUrl(userId: string, version?: string | number | null): string {
    const stamp = version != null && String(version).trim() ? String(version) : String(Date.now());
    const token = this.cachedToken;
    const session = token ? `&session=${encodeURIComponent(token)}` : '';
    return `${this.url(`/api/media/profile/${encodeURIComponent(userId)}`)}?v=${encodeURIComponent(stamp)}${session}`;
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
      personalEmail?: string;
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
      personalEmail?: string;
      phone?: string;
      address?: string;
      notes?: string;
      password?: string;
      confirmPassword?: string;
      adminPassword?: string;
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
      personalEmail?: string;
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
    return this.saveChanges(store, {
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
              personalEmail: (input.personalEmail || item.personalEmail || '').trim(),
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

  studentFileUrl(documentId: string, version?: string | number | null): string {
    const stamp = version != null && String(version).trim() ? String(version) : String(Date.now());
    return `${this.url(`/api/media/student-files/${encodeURIComponent(documentId)}`)}?v=${encodeURIComponent(stamp)}`;
  }

  async openStudentFile(documentId: string, version?: string | number | null): Promise<void> {
    const res = await fetch(this.studentFileUrl(documentId, version), {
      headers: await this.headers(false),
    });
    if (!res.ok) {
      await this.parse(res);
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    window.open(href, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  async uploadStudentFile(
    studentId: string,
    file: Blob,
    fileName: string,
    kind: string,
    title?: string,
  ): Promise<HirayaDatabase> {
    const headers = (await this.headers(false)) as Record<string, string>;
    const body = new FormData();
    body.append('file', file, fileName);
    body.append('kind', kind);
    if (title) body.append('title', title);
    const res = await fetch(this.url(`/api/students/${encodeURIComponent(studentId)}/files`), {
      method: 'POST',
      headers,
      body,
    });
    await this.parse(res);
    return this.getStore();
  }

  async uploadPaymentReceipt(paymentId: string, file: Blob, fileName: string): Promise<HirayaDatabase> {
    const headers = (await this.headers(false)) as Record<string, string>;
    const body = new FormData();
    body.append('file', file, fileName);
    const res = await fetch(this.url(`/api/payments/${encodeURIComponent(paymentId)}/receipt`), {
      method: 'POST',
      headers,
      body,
    });
    await this.parse(res);
    return this.getStore();
  }

  async openPaymentReceipt(paymentId: string): Promise<void> {
    const res = await fetch(this.url(`/api/payments/${encodeURIComponent(paymentId)}/receipt`), {
      headers: await this.headers(false),
    });
    if (!res.ok) {
      await this.parse(res);
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    window.open(href, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  async deleteStudentFile(studentId: string, documentId: string): Promise<HirayaDatabase> {
    const res = await fetch(
      this.url(`/api/students/${encodeURIComponent(studentId)}/files/${encodeURIComponent(documentId)}`),
      {
        method: 'DELETE',
        headers: await this.headers(false),
      },
    );
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
    const res = await fetch(this.url('/api/public/enrollment?v=20261015'), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(60000) : undefined,
    });
    return this.parse(res);
  }

  async submitInquiry(input: {
    name: string;
    email: string;
    phone: string;
    message: string;
  }): Promise<{ submitted?: boolean; emailed?: boolean }> {
    const res = await fetch(this.url('/api/public/inquiries'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(20000) : undefined,
    });
    return this.parse(res);
  }

  async applyTeacher(input: TeacherApplyInput): Promise<{ submitted?: boolean; applicationId?: string }> {
    const res = await fetch(this.url('/api/public/teacher-application'), {
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

  async saveModule(
    fields: {
      moduleId?: string;
      title: string;
      description?: string;
      programId?: string;
      subject?: string;
      gradeLevel?: string;
      moduleType?: string;
      classIds?: string[];
      version?: string;
      changeDescription?: string;
      publish?: boolean;
      notifyTeachers?: boolean;
      status?: string;
    },
    file?: File | null,
  ): Promise<HirayaDatabase> {
    const headers = (await this.headers(false)) as Record<string, string>;
    const body = new FormData();
    if (fields.moduleId) body.append('moduleId', fields.moduleId);
    body.append('title', fields.title || '');
    body.append('description', fields.description || '');
    body.append('programId', fields.programId || '');
    body.append('subject', fields.subject || '');
    body.append('gradeLevel', fields.gradeLevel || '');
    body.append('moduleType', fields.moduleType || '');
    body.append('classIds', (fields.classIds || []).join(','));
    body.append('version', fields.version || '');
    body.append('changeDescription', fields.changeDescription || '');
    body.append('publish', fields.publish === true || fields.status === 'published' ? 'true' : 'false');
    body.append('notifyTeachers', fields.notifyTeachers === false ? 'false' : 'true');
    if (file) body.append('file', file, file.name);
    const res = await fetch(this.url('/api/modules'), { method: 'POST', headers, body });
    const saved = await this.parse<{ moduleId?: string }>(res);
    const moduleId = saved?.moduleId || fields.moduleId;
    if (moduleId && fields.status && fields.status !== 'published') {
      await this.setModuleStatus(moduleId, fields.status);
    }
    return this.getStore();
  }

  async setModuleStatus(moduleId: string, status: string): Promise<HirayaDatabase> {
    const res = await fetch(this.url(`/api/modules/${encodeURIComponent(moduleId)}/status`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ status }),
    });
    await this.parse(res);
    return this.getStore();
  }

  async openModuleFile(moduleId: string, versionId?: string | null): Promise<void> {
    const query = new URLSearchParams();
    if (versionId) query.set('versionId', versionId);
    query.set('inline', 'true');
    const res = await fetch(
      this.url(`/api/modules/${encodeURIComponent(moduleId)}/file?${query.toString()}`),
      { headers: await this.headers(false) },
    );
    if (!res.ok) {
      await this.parse(res);
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const disposition = res.headers.get('content-disposition') || '';
    const named = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition)?.[1];
    const name = named ? decodeURIComponent(named.replace(/"/g, '')) : '';
    const opened = window.open(href, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const link = document.createElement('a');
      link.href = href;
      link.download = name || 'module';
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  async publishWebsite(input: {
    centerName: string;
    welcomeTitle: string;
    welcomeMessage: string;
    aboutTitle: string;
    description: string;
    mission: string;
    vision: string;
    values: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    businessHours: string;
    programs: { programId: string; name: string; description: string }[];
  }): Promise<void> {
    const res = await fetch(this.url('/api/admin/website/publish'), {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify(input),
    });
    await this.parse(res);
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

  async notifyStudentBalance(
    studentId: string,
    recipients?: { userId: string; personalEmail: string }[],
    accountNumber?: string,
    fromAccountNumber?: string,
  ): Promise<{
    notified: boolean;
    emailed: boolean;
    to: string;
    accountCount: number;
    smtpReady: boolean;
    emailError?: string | null;
  }> {
    const id = encodeURIComponent((studentId || '').trim());
    const res = await fetch(this.url(`/api/students/${id}/balance-notice`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        recipients: recipients || [],
        accountNumber: (accountNumber || '').trim(),
        fromAccountNumber: (fromAccountNumber || '').trim(),
      }),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(60000) : undefined,
    });
    return this.parse(res);
  }

  async notifyTeacherPayment(
    paymentId: string,
    personalEmail?: string,
    accountNumber?: string,
    fromAccountNumber?: string,
    amount?: number,
    amountPaid?: number,
  ): Promise<{
    notified: boolean;
    emailed: boolean;
    to: string;
    accountCount: number;
    smtpReady: boolean;
    emailError?: string | null;
  }> {
    const id = encodeURIComponent((paymentId || '').trim());
    const res = await fetch(this.url(`/api/payments/${id}/notify`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        personalEmail: (personalEmail || '').trim(),
        accountNumber: (accountNumber || '').trim(),
        fromAccountNumber: (fromAccountNumber || '').trim(),
        amount: Number.isFinite(amount) ? amount : undefined,
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : undefined,
      }),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(60000) : undefined,
    });
    return this.parse(res);
  }

  async sendTeacherPayslip(
    paymentId: string,
    personalEmail?: string,
    accountNumber?: string,
    fromAccountNumber?: string,
    amount?: number,
    amountPaid?: number,
  ): Promise<{ emailed: boolean; notified: boolean; to: string }> {
    const id = encodeURIComponent((paymentId || '').trim());
    const res = await fetch(this.url(`/api/payments/${id}/payslip`), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        personalEmail: (personalEmail || '').trim(),
        accountNumber: (accountNumber || '').trim(),
        fromAccountNumber: (fromAccountNumber || '').trim(),
        amount: Number.isFinite(amount) ? amount : undefined,
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : undefined,
      }),
    });
    return this.parse(res);
  }

  async sendParentFeedback(input: {
    targetType: 'center' | 'teacher';
    teacherId?: string;
    rating?: number;
    message: string;
  }): Promise<void> {
    const res = await fetch(this.url('/api/feedback'), {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({
        targetType: input.targetType,
        teacherId: input.teacherId || '',
        rating: input.rating ?? 0,
        message: input.message,
      }),
    });
    await this.parse(res);
  }
}

export function createHirayaApi(tokenStore: TokenStore, baseUrl?: string): HirayaApi {
  return new HirayaApi(tokenStore, baseUrl !== undefined ? resolveApiBaseUrl(baseUrl) : resolveApiBaseUrl());
}
