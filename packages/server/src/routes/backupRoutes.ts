import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { BackupService, BackupConfig } from '../services/backup.js';

export const backupRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取备份配置
  fastify.get('/api/backup/config', async () => {
    const cfg = BackupService.getConfig();
    // 敏感密码掩码返回
    return {
      success: true,
      data: {
        ...cfg,
        smtpPass: cfg.smtpPass ? '******' : '',
      },
    };
  });

  // 更新备份配置
  fastify.put('/api/backup/config', async (request, reply) => {
    const body = request.body as Partial<BackupConfig>;
    const current = BackupService.getConfig();
    
    // 如果传入的密码是掩码或空，则保留原有密码
    if (body.smtpPass === '******' || !body.smtpPass) {
      delete body.smtpPass;
    }

    const updated = BackupService.saveConfig(body);
    return {
      success: true,
      data: {
        ...updated,
        smtpPass: updated.smtpPass ? '******' : '',
      },
    };
  });

  // 立即触发备份
  fastify.post('/api/backup/now', async () => {
    const result = await BackupService.runBackup(true);
    return {
      success: true,
      data: {
        ...result,
        downloadUrl: `/api/backup/download/${result.filename}`,
      },
    };
  });

  // 下载指定的备份文件
  fastify.get('/api/backup/download/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeName = path.basename(filename);
    const filePath = path.resolve(BackupService.getBackupsDir(), safeName);

    if (!fs.existsSync(filePath)) {
      reply.status(404);
      return { success: false, error: 'Backup file not found' };
    }

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${safeName}"`);
    const stream = fs.createReadStream(filePath);
    return reply.send(stream);
  });

  // 获取历史备份文件清单
  fastify.get('/api/backup/history', async () => {
    const dir = BackupService.getBackupsDir();
    if (!fs.existsSync(dir)) {
      return { success: true, data: [] };
    }
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('chuqing_backup_') && f.endsWith('.zip'))
      .map((f) => {
        const p = path.resolve(dir, f);
        const stat = fs.statSync(p);
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          downloadUrl: `/api/backup/download/${f}`,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, data: files };
  });

  // 从历史备份文件一键还原
  fastify.post('/api/backup/restore/file', async (request, reply) => {
    const { filename } = request.body as { filename: string };
    if (!filename) {
      reply.status(400);
      return { success: false, error: '请指定需要还原的文件名' };
    }

    try {
      const stats = await BackupService.restoreFromFile(filename);
      return {
        success: true,
        data: {
          ...stats,
          message: `还原成功！已恢复 ${stats.notesCount} 篇笔记、${stats.foldersCount} 个分类与 ${stats.attachmentsCount} 个附件`,
        },
      };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: `还原失败: ${err.message}` };
    }
  });

  // 上传本地 Zip 备份包进行还原
  fastify.post('/api/backup/restore/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.status(400);
      return { success: false, error: '请选择需要上传的备份 Zip 压缩包' };
    }

    try {
      const buffer = await data.toBuffer();
      const stats = await BackupService.restoreFromZip(buffer);
      return {
        success: true,
        data: {
          ...stats,
          message: `还原成功！已恢复 ${stats.notesCount} 篇笔记、${stats.foldersCount} 个分类与 ${stats.attachmentsCount} 个附件`,
        },
      };
    } catch (err: any) {
      reply.status(500);
      return { success: false, error: `还原失败: ${err.message}` };
    }
  });
};
