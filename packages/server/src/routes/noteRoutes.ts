import { FastifyPluginAsync } from 'fastify';
import { NotesService } from '../services/notes.js';
import { StorageService } from '../services/storage.js';

export const noteRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取当前用户的笔记列表
  fastify.get('/api/notes', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const query = request.query as any;
    const filter = {
      folderId: query.folderId === 'null' ? null : query.folderId,
      isPinned: query.isPinned !== undefined ? query.isPinned === 'true' : undefined,
      isArchived: query.isArchived !== undefined ? query.isArchived === 'true' : undefined,
      isDeleted: query.isDeleted !== undefined ? query.isDeleted === 'true' : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    };
    const notes = NotesService.listNotes(userId, filter);
    return { success: true, data: notes };
  });

  // 获取单个笔记详情
  fastify.get('/api/notes/:id', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const note = NotesService.getNoteById(id, userId);
    if (!note) {
      reply.status(404);
      return { success: false, error: 'Note not found' };
    }
    const attachments = StorageService.getAttachmentsByNoteId(id);
    return { success: true, data: { ...note, attachments } };
  });

  // 创建新笔记
  fastify.post('/api/notes', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const body = request.body as any;
    const note = NotesService.createNote(userId, body);
    return { success: true, data: note };
  });

  // 更新笔记
  fastify.put('/api/notes/:id', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const updated = NotesService.updateNote(id, userId, body);
    if (!updated) {
      reply.status(404);
      return { success: false, error: 'Note not found' };
    }
    return { success: true, data: updated };
  });

  // 软删除（移入废纸篓）
  fastify.delete('/api/notes/:id', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const success = NotesService.softDeleteNote(id, userId);
    return { success };
  });

  // 恢复笔记
  fastify.post('/api/notes/:id/restore', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const success = NotesService.restoreNote(id, userId);
    return { success };
  });

  // 彻底删除笔记
  fastify.delete('/api/notes/:id/permanent', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const success = NotesService.permanentDeleteNote(id, userId);
    return { success };
  });

  // 清空废纸篓
  fastify.post('/api/notes/trash/empty', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const count = NotesService.emptyTrash(userId);
    return { success: true, count };
  });
};
