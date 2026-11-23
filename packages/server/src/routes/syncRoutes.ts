import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import { NotesService } from '../services/notes.js';

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  // 拉取服务端增量变动
  fastify.post('/api/sync/pull', async (request) => {
    const { sinceTimestamp } = (request.body as any) || { sinceTimestamp: 0 };
    const sinceDate = new Date(sinceTimestamp || 0).toISOString();
    const db = getDb();

    // 变动的笔记（含软删除）
    const changedNotesRaw = db.prepare(`SELECT * FROM notes WHERE updated_at > ?`).all(sinceDate) as any[];
    const notes = changedNotesRaw.map((r) => {
      let content = {};
      try {
        content = JSON.parse(r.content_json);
      } catch {}
      return {
        id: r.id,
        folderId: r.folder_id,
        title: r.title,
        content,
        snippet: r.snippet || '',
        isPinned: Boolean(r.is_pinned),
        isFavorite: Boolean(r.is_favorite),
        isArchived: Boolean(r.is_archived),
        isDeleted: Boolean(r.is_deleted),
        version: r.version,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    // 变动的文件夹
    const changedFoldersRaw = db.prepare(`SELECT * FROM folders WHERE updated_at > ?`).all(sinceDate) as any[];
    const folders = changedFoldersRaw.map((r) => ({
      id: r.id,
      name: r.name,
      parentId: r.parent_id,
      icon: r.icon,
      color: r.color,
      order: r.order_num,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return {
      success: true,
      data: {
        serverTimestamp: Date.now(),
        notes,
        folders,
      },
    };
  });

  // 推送客户端离线操作
  fastify.post('/api/sync/push', async (request) => {
    const userId = (request as any).user?.userId;
    const { notes } = (request.body as any) || { notes: [] };
    const results: any[] = [];

    for (const clientNote of notes) {
      const existing = NotesService.getNoteById(clientNote.id, userId);
      if (!existing) {
        // 服务端无该笔记，插入新笔记
        const created = NotesService.createNote(userId, clientNote);
        results.push({ id: created.id, status: 'created' });
      } else {
        // 存在笔记：若客户端版本更高或时间更晚，更新
        if (new Date(clientNote.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          const updated = NotesService.updateNote(clientNote.id, userId, clientNote);
          results.push({ id: clientNote.id, status: 'updated' });
        } else {
          results.push({ id: clientNote.id, status: 'conflict_ignored' });
        }
      }
    }

    return {
      success: true,
      data: {
        syncedCount: results.length,
        results,
        serverTimestamp: Date.now(),
      },
    };
  });
};
