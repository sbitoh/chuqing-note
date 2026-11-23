import { Note, NoteListItem, Folder, Attachment, ApiResponse } from '@chuqing/shared';

export const DEFAULT_SERVER_URL = '';

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );
}

export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('CHU_QING_SERVER_URL');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
    // Web 环境默认使用当前站点 origin
    if (!isNativePlatform() && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return '';
  }
  return '';
}

export function setServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('CHU_QING_SERVER_URL', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('CHU_QING_SERVER_URL');
    }
  }
}

export function getApiBase(): string {
  const base = getServerUrl();
  return `${base}/api`;
}

export function getAuthHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('CHU_QING_TOKEN');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: any) {
    throw new Error(`网络连接失败 (${err.message || '网络异常'})，请检查服务器连接`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error(`服务器响应非 JSON 数据 (${res.status})，请检查服务器地址是否正确`);
  }
}

export class ApiClient {
  // 探针检测
  static async testConnection(targetUrl?: string): Promise<{ ok: boolean; message: string }> {
    const base = targetUrl ? targetUrl.trim().replace(/\/+$/, '') : getServerUrl();
    try {
      const res = await fetch(`${base}/api/health`, { method: 'GET' });
      const text = await res.text();
      const data = JSON.parse(text);
      if (data && data.status === 'ok') {
        return { ok: true, message: `连接成功 (${data.service || '初晴笔记服务在线'})` };
      }
      return { ok: false, message: `服务器返回状态异常: ${text.slice(0, 50)}` };
    } catch (err: any) {
      return { ok: false, message: `连接失败: ${err.message || '无法连接'}` };
    }
  }

  // 鉴权相关接口 (模式 B：多账号体系)
  static async getAuthStatus(): Promise<{ hasUsers: boolean; authenticated: boolean; user?: any }> {
    const json = await safeFetchJson<ApiResponse<{ hasUsers: boolean; authenticated: boolean; user?: any }>>(
      `${getApiBase()}/auth/status`,
      { headers: getAuthHeaders(false) }
    );
    return json.data || { hasUsers: false, authenticated: false };
  }

  static async register(data: { username: string; password: string; nickname?: string }): Promise<{ token: string; user: any }> {
    const json = await safeFetchJson<ApiResponse<{ token: string; user: any }>>(
      `${getApiBase()}/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (!json.success || !json.data?.token) throw new Error(json.error || '注册失败');
    localStorage.setItem('CHU_QING_TOKEN', json.data.token);
    return json.data;
  }

  static async login(data: { username: string; password: string }): Promise<{ token: string; user: any }> {
    const json = await safeFetchJson<ApiResponse<{ token: string; user: any }>>(
      `${getApiBase()}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (!json.success || !json.data?.token) throw new Error(json.error || '用户名或密码错误');
    localStorage.setItem('CHU_QING_TOKEN', json.data.token);
    return json.data;
  }

  static logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('CHU_QING_TOKEN');
    }
  }

  // 笔记相关业务接口
  static async getNotes(filter: {
    folderId?: string | null;
    isPinned?: boolean;
    isArchived?: boolean;
    isDeleted?: boolean;
    search?: string;
  } = {}): Promise<NoteListItem[]> {
    const params = new URLSearchParams();
    if (filter.folderId !== undefined) params.append('folderId', filter.folderId === null ? 'null' : filter.folderId);
    if (filter.isPinned !== undefined) params.append('isPinned', String(filter.isPinned));
    if (filter.isArchived !== undefined) params.append('isArchived', String(filter.isArchived));
    if (filter.isDeleted !== undefined) params.append('isDeleted', String(filter.isDeleted));
    if (filter.search) params.append('search', filter.search);

    const json = await safeFetchJson<ApiResponse<NoteListItem[]>>(
      `${getApiBase()}/notes?${params.toString()}`,
      { headers: getAuthHeaders(false) }
    );
    return json.data || [];
  }

  static async getNote(id: string): Promise<Note & { attachments: Attachment[] }> {
    const json = await safeFetchJson<ApiResponse<Note & { attachments: Attachment[] }>>(
      `${getApiBase()}/notes/${id}`,
      { headers: getAuthHeaders(false) }
    );
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to load note');
    return json.data;
  }

  static async createNote(data: Partial<Note>): Promise<Note> {
    const json = await safeFetchJson<ApiResponse<Note>>(
      `${getApiBase()}/notes`,
      {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(data),
      }
    );
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to create note');
    return json.data;
  }

  static async updateNote(id: string, data: Partial<Note>): Promise<Note> {
    const json = await safeFetchJson<ApiResponse<Note>>(
      `${getApiBase()}/notes/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify(data),
      }
    );
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update note');
    return json.data;
  }

  static async deleteNote(id: string): Promise<boolean> {
    const json = await safeFetchJson<ApiResponse>(
      `${getApiBase()}/notes/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(false),
      }
    );
    return json.success;
  }

  static async restoreNote(id: string): Promise<boolean> {
    const json = await safeFetchJson<ApiResponse>(
      `${getApiBase()}/notes/${id}/restore`,
      {
        method: 'POST',
        headers: getAuthHeaders(false),
      }
    );
    return json.success;
  }

  static async permanentDeleteNote(id: string): Promise<boolean> {
    const json = await safeFetchJson<ApiResponse>(
      `${getApiBase()}/notes/${id}/permanent`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(false),
      }
    );
    return json.success;
  }

  static async emptyTrash(): Promise<boolean> {
    const json = await safeFetchJson<ApiResponse>(
      `${getApiBase()}/notes/trash/empty`,
      {
        method: 'POST',
        headers: getAuthHeaders(false),
      }
    );
    return json.success;
  }

  static async getFolders(): Promise<Folder[]> {
    const json = await safeFetchJson<ApiResponse<Folder[]>>(
      `${getApiBase()}/folders`,
      { headers: getAuthHeaders(false) }
    );
    return json.data || [];
  }

  static async createFolder(name: string, parentId: string | null = null): Promise<Folder> {
    const json = await safeFetchJson<ApiResponse<Folder>>(
      `${getApiBase()}/folders`,
      {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ name, parentId }),
      }
    );
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to create folder');
    return json.data;
  }

  static async updateFolder(id: string, data: Partial<Folder>): Promise<Folder> {
    const json = await safeFetchJson<ApiResponse<Folder>>(
      `${getApiBase()}/folders/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify(data),
      }
    );
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to update folder');
    return json.data;
  }

  static async deleteFolder(id: string): Promise<boolean> {
    const json = await safeFetchJson<ApiResponse>(
      `${getApiBase()}/folders/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(false),
      }
    );
    return json.success;
  }

  // ===== 备份系统 API =====

  static async getBackupConfig(): Promise<any> {
    const json = await safeFetchJson<ApiResponse<any>>(
      `${getApiBase()}/backup/config`,
      { headers: getAuthHeaders(false) }
    );
    return json.data;
  }

  static async saveBackupConfig(data: any): Promise<any> {
    const json = await safeFetchJson<ApiResponse<any>>(
      `${getApiBase()}/backup/config`,
      {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify(data),
      }
    );
    return json.data;
  }

  static async triggerBackupNow(): Promise<any> {
    const json = await safeFetchJson<ApiResponse<any>>(
      `${getApiBase()}/backup/now`,
      {
        method: 'POST',
        headers: getAuthHeaders(false),
      }
    );
    return json.data;
  }

  static async getBackupHistory(): Promise<any[]> {
    const json = await safeFetchJson<ApiResponse<any[]>>(
      `${getApiBase()}/backup/history`,
      { headers: getAuthHeaders(false) }
    );
    return json.data || [];
  }

  static async restoreFromHistory(filename: string): Promise<any> {
    const json = await safeFetchJson<ApiResponse<any>>(
      `${getApiBase()}/backup/restore/file`,
      {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ filename }),
      }
    );
    return json.data;
  }

  static async restoreFromUpload(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const headers = getAuthHeaders(false);

    let res: Response;
    try {
      res = await fetch(`${getApiBase()}/backup/restore/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err: any) {
      throw new Error(`上传备份文件网络失败: ${err.message}`);
    }

    const text = await res.text();
    const json: ApiResponse<any> = JSON.parse(text);
    if (!json.success || !json.data) throw new Error(json.error || '还原备份失败');
    return json.data;
  }

  /**
   * 上传附件（带鉴权 Token）
   */
  static async uploadAttachment(file: File, noteId?: string | null): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (noteId) formData.append('noteId', noteId);

    const headers = getAuthHeaders(false);

    let res: Response;
    try {
      res = await fetch(`${getApiBase()}/attachments/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err: any) {
      throw new Error(`上传附件网络失败: ${err.message}`);
    }

    const text = await res.text();
    const json: ApiResponse<Attachment> = JSON.parse(text);
    if (!json.success || !json.data) throw new Error(json.error || 'Failed to upload attachment');
    return json.data;
  }
}
