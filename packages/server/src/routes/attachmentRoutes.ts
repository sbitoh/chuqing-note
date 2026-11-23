import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import { StorageService } from '../services/storage.js';

export const attachmentRoutes: FastifyPluginAsync = async (fastify) => {
  // 流式上传附件（支持任意格式大文件，内存占用极小）
  fastify.post('/api/attachments/upload', async (request, reply) => {
    const data = await request.file({
      limits: {
        fileSize: 1024 * 1024 * 500, // 500MB
      },
    });

    if (!data) {
      reply.status(400);
      return { success: false, error: 'No file uploaded' };
    }

    const fields = data.fields as any;
    const noteId = fields?.noteId?.value;

    const attachment = await StorageService.saveAttachment({
      filename: data.filename,
      mimetype: data.mimetype,
      fileStream: data.file,
      noteId: noteId || null,
    });

    return {
      success: true,
      data: attachment,
    };
  });

  // 获取附件元数据
  fastify.get('/api/attachments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const attachment = StorageService.getAttachmentById(id);
    if (!attachment) {
      reply.status(404);
      return { success: false, error: 'Attachment not found' };
    }
    return { success: true, data: attachment };
  });

  // 下载附件 (Content-Disposition: attachment)
  fastify.get('/api/attachments/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    const attachment = StorageService.getAttachmentById(id);
    if (!attachment) {
      reply.status(404);
      return reply.send({ success: false, error: 'Attachment not found' });
    }

    const absPath = StorageService.getAbsoluteFilePath(attachment.storagePath);
    if (!fs.existsSync(absPath)) {
      reply.status(404);
      return reply.send({ success: false, error: 'Physical file not found on NAS' });
    }

    const encodedName = encodeURIComponent(attachment.originalName);
    reply.header('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    reply.header('Content-Type', attachment.mimeType);

    const stream = fs.createReadStream(absPath);
    return reply.send(stream);
  });

  // 内联预览 (图片、PDF、音视频流式点播，支持 HTTP 206 Range)
  fastify.get('/api/attachments/:id/view', async (request, reply) => {
    const { id } = request.params as { id: string };
    const attachment = StorageService.getAttachmentById(id);
    if (!attachment) {
      reply.status(404);
      return reply.send({ success: false, error: 'Attachment not found' });
    }

    const absPath = StorageService.getAbsoluteFilePath(attachment.storagePath);
    if (!fs.existsSync(absPath)) {
      reply.status(404);
      return reply.send({ success: false, error: 'Physical file not found on NAS' });
    }

    const stat = fs.statSync(absPath);
    const range = request.headers.range;

    // 支持音视频/PDF拖动切片的 Range 响应
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;

      reply.status(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Length', chunksize);
      reply.header('Content-Type', attachment.mimeType);

      const stream = fs.createReadStream(absPath, { start, end });
      return reply.send(stream);
    }

    reply.header('Content-Length', stat.size);
    reply.header('Content-Type', attachment.mimeType);
    reply.header('Accept-Ranges', 'bytes');
    const stream = fs.createReadStream(absPath);
    return reply.send(stream);
  });
};
