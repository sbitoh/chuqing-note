import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { noteRoutes } from './routes/noteRoutes.js';
import { folderRoutes } from './routes/folderRoutes.js';
import { attachmentRoutes } from './routes/attachmentRoutes.js';
import { syncRoutes } from './routes/syncRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { backupRoutes } from './routes/backupRoutes.js';
import { BackupService } from './services/backup.js';
import { NotesService } from './services/notes.js';
import { AuthService } from './services/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: config.maxFileSize,
  });

  // 允许跨域（方便开发与移动端访问）
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 注册流式文件上传插件
  await fastify.register(multipart, {
    limits: {
      fileSize: config.maxFileSize,
    },
  });

  // 注册全局鉴权安全拦截守卫
  fastify.addHook('preHandler', async (request, reply) => {
    const url = request.raw.url || '';
    if (url.startsWith('/api') && !url.startsWith('/api/auth') && !url.startsWith('/api/health')) {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ success: false, error: 'Unauthorized: 请先解锁初晴笔记' });
        return;
      }
      const token = authHeader.substring(7);
      const payload = AuthService.verifyToken(token);
      if (!payload) {
        reply.status(401).send({ success: false, error: 'Unauthorized: 登录凭证已失效，请重新登录' });
        return;
      }
      (request as any).user = payload;
    }
  });

  // 注册业务 API 路由
  await fastify.register(authRoutes);
  await fastify.register(noteRoutes);
  await fastify.register(folderRoutes);
  await fastify.register(attachmentRoutes);
  await fastify.register(syncRoutes);
  await fastify.register(backupRoutes);

  // 初始化备份定时器与目录
  BackupService.init();

  // 探针接口
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'ChuQing Note Server',
      timestamp: new Date().toISOString(),
    };
  });

  // 静态 Web 资源托管（前端构建产物）
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDistPath)) {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA 路由 fallback
    fastify.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        reply.status(404).send({ success: false, error: 'API endpoint not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  // 初始化数据库并播种示例笔记（如果为空）
  getDb();
  seedWelcomeNote();

  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`\n======================================================`);
    console.log(`  🌤️ 初晴笔记 (ChuQing Note) 服务已启动`);
    console.log(`  📡 本地地址: http://127.0.0.1:${config.port}`);
    console.log(`  💾 数据目录: ${config.dataDir}`);
    console.log(`======================================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

function seedWelcomeNote() {
  const db = getDb();
  const count = db.prepare(`SELECT COUNT(*) as count FROM notes`).get() as any;
  if (count && count.count === 0) {
    const welcomeContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '欢迎使用 初晴笔记 (ChuQing Note) 🌤️' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '初晴笔记是一款专为私有云与 NAS 打造的现代化、离线优先富文本笔记系统。彻底告别繁琐的 Markdown 语法，享受纯粹的所见即所得书写体验。',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '✨ 核心特色' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '所见即所得（WYSIWYG）' },
                    { type: 'text', text: '：无需记忆任何语法符号，如同 Word / Notion 般自然排版。' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '万能附件胶囊（Universal File Capsule）' },
                    { type: 'text', text: '：直接将 PDF、图片、音视频、压缩包或文档拖入光标处，自动生成卡片预览与直接下载。' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'NAS 数据完全私有' },
                    { type: 'text', text: '：基于 SQLite WAL 模式与物理附件池，支持 SHA-256 哈希去重。' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '多端同构与离线优先' },
                    { type: 'text', text: '：支持浏览器 Web 版与安卓客户端，断网照常编辑，联网自动同步。' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    NotesService.createNote('system', {
      title: '欢迎使用 初晴笔记 (ChuQing Note) 🌤️',
      content: welcomeContent,
      isPinned: true,
    });
  }
}

startServer();
