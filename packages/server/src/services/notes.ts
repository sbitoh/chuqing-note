import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { Note, NoteListItem } from '@chuqing/shared';

export interface NoteFilter {
  folderId?: string | null;
  isPinned?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class NotesService {
  /**
   * 获取某用户的笔记列表（轻量摘要，不含庞大 JSON）
   */
  static listNotes(userId: string, filter: NoteFilter = {}): NoteListItem[] {
    const db = getDb();
    const conditions: string[] = ['(n.user_id = ? OR n.user_id IS NULL)'];
    const params: any[] = [userId];

    // 默认只查未删除且未归档
    if (filter.isDeleted !== undefined) {
      conditions.push('n.is_deleted = ?');
      params.push(filter.isDeleted ? 1 : 0);
    } else {
      conditions.push('n.is_deleted = 0');
    }

    if (filter.isArchived !== undefined) {
      conditions.push('n.is_archived = ?');
      params.push(filter.isArchived ? 1 : 0);
    } else if (filter.isDeleted === undefined) {
      conditions.push('n.is_archived = 0');
    }

    if (filter.folderId !== undefined) {
      if (filter.folderId === null) {
        conditions.push('n.folder_id IS NULL');
      } else {
        conditions.push('n.folder_id = ?');
        params.push(filter.folderId);
      }
    }

    if (filter.search && filter.search.trim()) {
      conditions.push('(n.title LIKE ? OR n.snippet LIKE ?)');
      const keyword = `%${filter.search.trim()}%`;
      params.push(keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const query = `
      SELECT 
        n.id, n.folder_id, n.title, n.snippet, n.is_pinned, n.is_favorite, n.is_archived, n.updated_at,
        COUNT(a.id) as attachment_count
      FROM notes n
      LEFT JOIN attachments a ON n.id = a.note_id
      ${whereClause}
      GROUP BY n.id
      ORDER BY n.is_pinned DESC, n.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      folderId: r.folder_id,
      title: r.title || '无标题笔记',
      snippet: r.snippet || '',
      isPinned: Boolean(r.is_pinned),
      isFavorite: Boolean(r.is_favorite),
      isArchived: Boolean(r.is_archived),
      updatedAt: r.updated_at,
      attachmentCount: r.attachment_count || 0,
    }));
  }

  /**
   * 获取笔记详情
   */
  static getNoteById(id: string, userId: string): Note | null {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM notes WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).get(id, userId) as any;
    if (!row) return null;

    let content = {};
    try {
      content = JSON.parse(row.content_json);
    } catch {
      content = {};
    }

    return {
      id: row.id,
      userId: row.user_id,
      folderId: row.folder_id,
      title: row.title,
      content,
      snippet: row.snippet || '',
      isPinned: Boolean(row.is_pinned),
      isFavorite: Boolean(row.is_favorite),
      isArchived: Boolean(row.is_archived),
      isDeleted: Boolean(row.is_deleted),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建或保存新笔记
   */
  static createNote(userId: string, data: Partial<Note>): Note {
    const db = getDb();
    const id = data.id || nanoid(16);
    const now = new Date().toISOString();
    const title = data.title || '新笔记';
    const content = data.content || { type: 'doc', content: [] };
    const contentJson = JSON.stringify(content);
    const snippet = data.snippet || this.extractSnippet(content);

    const stmt = db.prepare(`
      INSERT INTO notes (
        id, user_id, folder_id, title, content_json, snippet, is_pinned, is_favorite, is_archived, is_deleted, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      data.folderId || null,
      title,
      contentJson,
      snippet,
      data.isPinned ? 1 : 0,
      data.isFavorite ? 1 : 0,
      0,
      0,
      1,
      now,
      now
    );

    return {
      id,
      userId,
      folderId: data.folderId || null,
      title,
      content,
      snippet,
      isPinned: Boolean(data.isPinned),
      isFavorite: Boolean(data.isFavorite),
      isArchived: false,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 更新已有笔记
   */
  static updateNote(id: string, userId: string, data: Partial<Note>): Note | null {
    const db = getDb();
    const existing = this.getNoteById(id, userId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const title = data.title !== undefined ? data.title : existing.title;
    const content = data.content !== undefined ? data.content : existing.content;
    const contentJson = JSON.stringify(content);
    const snippet = data.snippet !== undefined ? data.snippet : this.extractSnippet(content);
    const folderId = data.folderId !== undefined ? data.folderId : existing.folderId;
    const isPinned = data.isPinned !== undefined ? (data.isPinned ? 1 : 0) : (existing.isPinned ? 1 : 0);
    const isFavorite = data.isFavorite !== undefined ? (data.isFavorite ? 1 : 0) : (existing.isFavorite ? 1 : 0);
    const isArchived = data.isArchived !== undefined ? (data.isArchived ? 1 : 0) : (existing.isArchived ? 1 : 0);
    const isDeleted = data.isDeleted !== undefined ? (data.isDeleted ? 1 : 0) : (existing.isDeleted ? 1 : 0);
    const version = existing.version + 1;

    db.prepare(`
      UPDATE notes SET 
        folder_id = ?,
        title = ?,
        content_json = ?,
        snippet = ?,
        is_pinned = ?,
        is_favorite = ?,
        is_archived = ?,
        is_deleted = ?,
        version = ?,
        updated_at = ?
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `).run(folderId, title, contentJson, snippet, isPinned, isFavorite, isArchived, isDeleted, version, now, id, userId);

    return {
      id,
      userId,
      folderId,
      title,
      content,
      snippet,
      isPinned: Boolean(isPinned),
      isFavorite: Boolean(isFavorite),
      isArchived: Boolean(isArchived),
      isDeleted: Boolean(isDeleted),
      version,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  /**
   * 移入废纸篓（软删除）
   */
  static softDeleteNote(id: string, userId: string): boolean {
    const db = getDb();
    const res = db.prepare(`UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(new Date().toISOString(), id, userId);
    return res.changes > 0;
  }

  /**
   * 从废纸篓还原
   */
  static restoreNote(id: string, userId: string): boolean {
    const db = getDb();
    const res = db.prepare(`UPDATE notes SET is_deleted = 0, updated_at = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(new Date().toISOString(), id, userId);
    return res.changes > 0;
  }

  /**
   * 彻底删除单篇笔记
   */
  static permanentDeleteNote(id: string, userId: string): boolean {
    const db = getDb();
    db.prepare(`DELETE FROM attachments WHERE note_id = ?`).run(id);
    const res = db.prepare(`DELETE FROM notes WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(id, userId);
    return res.changes > 0;
  }

  /**
   * 清空废纸篓
   */
  static emptyTrash(userId: string): number {
    const db = getDb();
    const deletedNotes = db.prepare(`SELECT id FROM notes WHERE is_deleted = 1 AND (user_id = ? OR user_id IS NULL)`).all(userId) as { id: string }[];
    for (const n of deletedNotes) {
      db.prepare(`DELETE FROM attachments WHERE note_id = ?`).run(n.id);
    }
    const res = db.prepare(`DELETE FROM notes WHERE is_deleted = 1 AND (user_id = ? OR user_id IS NULL)`).run(userId);
    return res.changes;
  }

  /**
   * 辅助工具：从 Tiptap JSON 递归提取前 150 个字符纯文本作为摘要
   */
  private static extractSnippet(node: any): string {
    if (!node) return '';
    let text = '';

    function traverse(n: any) {
      if (text.length >= 150) return;
      if (n.type === 'text' && n.text) {
        text += n.text + ' ';
      }
      if (Array.isArray(n.content)) {
        for (const child of n.content) {
          traverse(child);
        }
      }
    }

    traverse(node);
    return text.trim().slice(0, 150);
  }
}
