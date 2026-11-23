import { FastifyPluginAsync } from 'fastify';
import { FoldersService } from '../services/folders.js';

export const folderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/folders', async (request) => {
    const userId = (request as any).user?.userId;
    const folders = FoldersService.listFolders(userId);
    return { success: true, data: folders };
  });

  fastify.post('/api/folders', async (request) => {
    const userId = (request as any).user?.userId;
    const body = request.body as any;
    const folder = FoldersService.createFolder(userId, body.name, body.parentId, body.icon, body.color);
    return { success: true, data: folder };
  });

  fastify.put('/api/folders/:id', async (request, reply) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const folder = FoldersService.updateFolder(id, userId, body);
    if (!folder) {
      reply.status(404);
      return { success: false, error: 'Folder not found' };
    }
    return { success: true, data: folder };
  });

  fastify.delete('/api/folders/:id', async (request) => {
    const userId = (request as any).user?.userId;
    const { id } = request.params as { id: string };
    const success = FoldersService.deleteFolder(id, userId);
    return { success };
  });
};
