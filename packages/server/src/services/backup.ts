import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';
import { getDb } from '../db/index.js';
import { config } from '../config.js';

const require = createRequire(import.meta.url);
const archiverPkg = require('archiver');
const ZipArchive = archiverPkg.ZipArchive || archiverPkg;
const AdmZip = require('adm-zip');

export interface BackupConfig {
  backupEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
  lastBackupTime?: string | null;
  lastBackupStatus?: string | null;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  backupEmail: '',
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  autoBackupEnabled: true,
  autoBackupIntervalDays: 3,
  lastBackupTime: null,
  lastBackupStatus: null,
};

export class BackupService {
  private static backupsDir = path.resolve(config.dataDir, 'backups');
  private static schedulerTimer: NodeJS.Timeout | null = null;

  static init() {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
    this.startScheduler();
  }

  static getBackupsDir(): string {
    return this.backupsDir;
  }

  static getConfig(): BackupConfig {
    const db = getDb();
    const row = db.prepare(`SELECT value FROM system_config WHERE key = 'backup_config'`).get() as any;
    if (!row) {
      return { ...DEFAULT_BACKUP_CONFIG };
    }
    try {
      return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(row.value) };
    } catch {
      return { ...DEFAULT_BACKUP_CONFIG };
    }
  }

  static saveConfig(newConfig: Partial<BackupConfig>): BackupConfig {
    const current = this.getConfig();
    const updated = { ...current, ...newConfig };
    const db = getDb();
    db.prepare(`
      INSERT INTO system_config (key, value)
      VALUES ('backup_config', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(updated));
    return updated;
  }

  /**
   * 生成全量备份 Zip 包（包含 SQLite 数据库、纯文本 Markdown 镜像与所有附件）
   */
  static async createBackupZip(): Promise<{
    filePath: string;
    filename: string;
    size: number;
    notesCount: number;
    attachmentsCount: number;
  }> {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `chuqing_backup_${timestampStr}.zip`;
    const filePath = path.resolve(this.backupsDir, filename);

    const db = getDb();

    // 1. 获取所有文件夹映射
    const folders = db.prepare(`SELECT id, name FROM folders`).all() as { id: string; name: string }[];
    const folderMap = new Map<string, string>();
    for (const f of folders) {
      folderMap.set(f.id, f.name);
    }

    // 2. 获取所有非软删除笔记
    const notes = db.prepare(`SELECT * FROM notes WHERE is_deleted = 0`).all() as any[];

    // 3. 获取所有附件
    const attachments = db.prepare(`SELECT * FROM attachments`).all() as any[];

    // 使用 archiver 打包
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = typeof archiverPkg === 'function'
        ? archiverPkg('zip', { zlib: { level: 9 } })
        : new ZipArchive({ zlib: { level: 9 } });

      output.on('close', () => {
        resolve({
          filePath,
          filename,
          size: archive.pointer(),
          notesCount: notes.length,
          attachmentsCount: attachments.length,
        });
      });

      archive.on('error', (err: any) => reject(err));
      archive.pipe(output);

      // (A) 数据库快照
      if (fs.existsSync(config.dbPath)) {
        archive.file(config.dbPath, { name: 'database/chuqing.db' });
      }

      // (B) 物理纯文本 Markdown 文件树生成
      for (const note of notes) {
        const folderName = (note.folder_id && folderMap.get(note.folder_id)) ? folderMap.get(note.folder_id)! : '未分类';
        const safeTitle = (note.title || '无标题笔记').replace(/[/\\?%*:|"<>]/g, '_');
        const mdFilename = `markdown_notes/${folderName}/${safeTitle}.md`;

        let contentJson: any = null;
        try {
          contentJson = JSON.parse(note.content_json);
        } catch {
          contentJson = null;
        }

        const mdBody = this.tiptapToMarkdown(contentJson);
        const mdFull = `---
title: "${(note.title || '无标题').replace(/"/g, '\\"')}"
folder: "${folderName}"
created_at: "${note.created_at}"
updated_at: "${note.updated_at}"
is_pinned: ${Boolean(note.is_pinned)}
version: ${note.version || 1}
---

# ${note.title || '无标题笔记'}

${mdBody}
`;
        archive.append(mdFull, { name: mdFilename });
      }

      // (C) 实体附件归档
      if (fs.existsSync(config.storageDir)) {
        archive.directory(config.storageDir, 'attachments');
      }

      // (D) 备份清单元数据
      const manifest = {
        appName: '初晴笔记 (ChuQing Note)',
        version: '1.0.0',
        backupTime: now.toISOString(),
        totalNotes: notes.length,
        totalAttachments: attachments.length,
      };
      archive.append(JSON.stringify(manifest, null, 2), { name: 'backup_manifest.json' });

      archive.finalize();
    });
  }

  /**
   * 将备份 Zip 通过 SMTP 邮件发送给备份邮箱
   */
  static async sendBackupEmail(filePath: string, filename: string, stats: { notesCount: number; attachmentsCount: number; size: number }): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg.backupEmail || !cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
      throw new Error('未配置完整的 SMTP 发信服务器与接收邮箱，无法发送邮件');
    }

    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort || (cfg.smtpSecure ? 465 : 587),
      secure: cfg.smtpSecure,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    const dateStr = new Date().toLocaleString();

    const mailOptions = {
      from: cfg.smtpFrom || cfg.smtpUser,
      to: cfg.backupEmail,
      subject: `[初晴笔记] 数据全量安全备份 (${new Date().toISOString().slice(0, 10)})`,
      text: `您好！初晴笔记已为您生成最新数据全量备份。\n\n备份生成时间：${dateStr}\n笔记总数：${stats.notesCount} 篇\n附件总数：${stats.attachmentsCount} 个\n备份包大小：${sizeMb} MB\n\n附件中包含了最新的完整备份包 (${filename})，内含数据库快照、纯文本 Markdown 树及所有文件附件，请妥善保存。`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #0369a1; margin: 0; font-size: 20px;">☁️ 初晴笔记 · 数据全量安全备份</h2>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">您好！系统已按计划为您生成全量数据备份，包含数据库快照、纯文本 Markdown 与所有关联附件。</p>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
              <tr><td style="padding: 6px 0; font-weight: bold;">备份文件名：</td><td>${filename}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">备份时间：</td><td>${dateStr}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">笔记总数：</td><td>${stats.notesCount} 篇</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">附件总数：</td><td>${stats.attachmentsCount} 个</td></tr>
              <tr><td style="padding: 6px 0; font-weight: bold;">文件大小：</td><td>${sizeMb} MB</td></tr>
            </table>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">* 提示：邮件附件已附带完整 Zip 归档包。即使没有服务端环境，您也可以解压后用任意 Markdown 编辑器直接阅读所有笔记正文。</p>
        </div>
      `,
      attachments: [
        {
          filename,
          path: filePath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  }

  /**
   * 触发立即备份（生成包并在条件满足时邮件发送）
   */
  static async runBackup(manual = true): Promise<{
    success: boolean;
    filename: string;
    size: number;
    notesCount: number;
    attachmentsCount: number;
    emailed: boolean;
    message: string;
  }> {
    const cfg = this.getConfig();
    let zipResult: any = null;

    try {
      zipResult = await this.createBackupZip();
    } catch (e: any) {
      this.saveConfig({ lastBackupStatus: `生成备份压缩包失败: ${e.message}` });
      throw new Error(`生成备份压缩包失败: ${e.message}`);
    }

    let emailed = false;
    let message = '备份文件生成成功';

    // 若配置了邮箱，尝试发送邮件
    if (cfg.backupEmail && cfg.smtpHost && cfg.smtpUser && cfg.smtpPass) {
      try {
        await this.sendBackupEmail(zipResult.filePath, zipResult.filename, zipResult);
        emailed = true;
        message = `备份成功，已发送至邮箱 ${cfg.backupEmail}`;
      } catch (err: any) {
        message = `备份文件已生成，但邮件发送失败 (${err.message})`;
      }
    } else {
      message = '备份文件已生成，但尚未配置完整的 SMTP 备份邮箱，未执行邮件发送';
    }

    this.saveConfig({
      lastBackupTime: new Date().toISOString(),
      lastBackupStatus: message,
    });

    // 清理旧的备份文件，保留最近 5 份
    this.cleanOldBackups(5);

    return {
      success: true,
      filename: zipResult.filename,
      size: zipResult.size,
      notesCount: zipResult.notesCount,
      attachmentsCount: zipResult.attachmentsCount,
      emailed,
      message,
    };
  }

  /**
   * 从服务端历史备份文件还原数据
   */
  static async restoreFromFile(filename: string): Promise<{
    notesCount: number;
    foldersCount: number;
    attachmentsCount: number;
  }> {
    const safeName = path.basename(filename);
    const filePath = path.resolve(this.backupsDir, safeName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`未找到备份文件: ${safeName}`);
    }
    return this.restoreFromZip(filePath);
  }

  /**
   * 从 Zip 压缩包（路径或 Buffer）还原数据
   * 自动在还原前生成安全快照，确保数据万无一失
   */
  static async restoreFromZip(zipSource: string | Buffer): Promise<{
    notesCount: number;
    foldersCount: number;
    attachmentsCount: number;
  }> {
    // 1. 还原前先自动创建安全快照（即便发生任何异常也可随时回滚）
    try {
      await this.runBackup(false);
    } catch (e: any) {
      console.warn('⚠️ 还原前自动安全快照异常:', e.message);
    }

    const zip = new AdmZip(zipSource);
    const dbEntry = zip.getEntry('database/chuqing.db');

    let restoredNotesCount = 0;
    let restoredFoldersCount = 0;
    let restoredAttachmentsCount = 0;

    if (dbEntry) {
      // 场景 A: 包含完整 SQLite 数据库快照的标准化初晴备份包
      const tempDbPath = path.resolve(config.dataDir, `temp_restore_${Date.now()}.db`);
      fs.writeFileSync(tempDbPath, dbEntry.getData());

      let tempDb: Database.Database | null = null;
      try {
        tempDb = new Database(tempDbPath, { readonly: true });
        const folders = tempDb.prepare(`SELECT * FROM folders`).all() as any[];
        const notes = tempDb.prepare(`SELECT * FROM notes`).all() as any[];
        let attachments: any[] = [];
        try {
          attachments = tempDb.prepare(`SELECT * FROM attachments`).all() as any[];
        } catch {}
        let users: any[] = [];
        try {
          users = tempDb.prepare(`SELECT * FROM users`).all() as any[];
        } catch {}

        const activeDb = getDb();
        const restoreTx = activeDb.transaction(() => {
          // 1. 用户信息合并（不覆盖已有密码）
          for (const u of users) {
            activeDb.prepare(`
              INSERT INTO users (id, username, password_hash, password_salt, nickname, role, created_at, updated_at)
              VALUES (@id, @username, @password_hash, @password_salt, @nickname, @role, @created_at, @updated_at)
              ON CONFLICT(username) DO NOTHING
            `).run(u);
          }

          // 2. 文件夹更新/插入
          for (const f of folders) {
            activeDb.prepare(`
              INSERT INTO folders (id, name, parent_id, icon, color, order_num, created_at, updated_at, user_id)
              VALUES (@id, @name, @parent_id, @icon, @color, @order_num, @created_at, @updated_at, @user_id)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                parent_id = excluded.parent_id,
                icon = excluded.icon,
                color = excluded.color,
                order_num = excluded.order_num,
                updated_at = excluded.updated_at,
                user_id = excluded.user_id
            `).run({
              ...f,
              user_id: f.user_id || null,
            });
          }

          // 3. 笔记数据更新/插入
          for (const n of notes) {
            activeDb.prepare(`
              INSERT INTO notes (id, folder_id, title, content_json, snippet, is_pinned, is_favorite, is_archived, is_deleted, version, created_at, updated_at, user_id)
              VALUES (@id, @folder_id, @title, @content_json, @snippet, @is_pinned, @is_favorite, @is_archived, @is_deleted, @version, @created_at, @updated_at, @user_id)
              ON CONFLICT(id) DO UPDATE SET
                folder_id = excluded.folder_id,
                title = excluded.title,
                content_json = excluded.content_json,
                snippet = excluded.snippet,
                is_pinned = excluded.is_pinned,
                is_favorite = excluded.is_favorite,
                is_archived = excluded.is_archived,
                is_deleted = excluded.is_deleted,
                version = excluded.version,
                updated_at = excluded.updated_at,
                user_id = excluded.user_id
            `).run({
              ...n,
              user_id: n.user_id || null,
            });
          }

          // 4. 附件记录更新/插入
          for (const a of attachments) {
            activeDb.prepare(`
              INSERT INTO attachments (id, note_id, original_name, mime_type, size, hash, storage_path, category, width, height, duration, created_at, user_id)
              VALUES (@id, @note_id, @original_name, @mime_type, @size, @hash, @storage_path, @category, @width, @height, @duration, @created_at, @user_id)
              ON CONFLICT(id) DO UPDATE SET
                note_id = excluded.note_id,
                original_name = excluded.original_name,
                mime_type = excluded.mime_type,
                size = excluded.size,
                hash = excluded.hash,
                storage_path = excluded.storage_path,
                category = excluded.category,
                width = excluded.width,
                height = excluded.height,
                duration = excluded.duration,
                user_id = excluded.user_id
            `).run({
              ...a,
              user_id: a.user_id || null,
            });
          }
        });

        restoreTx();

        restoredNotesCount = notes.length;
        restoredFoldersCount = folders.length;
      } finally {
        if (tempDb) {
          try { tempDb.close(); } catch {}
        }
        try { fs.unlinkSync(tempDbPath); } catch {}
      }
    } else {
      // 场景 B: Markdown 目录树备份包
      const entries = zip.getEntries();
      const activeDb = getDb();
      const nowIso = new Date().toISOString();

      for (const entry of entries) {
        if (!entry.isDirectory && (entry.entryName.endsWith('.md') || entry.entryName.startsWith('markdown_notes/'))) {
          const rawText = entry.getData().toString('utf8');
          let title = path.basename(entry.entryName, '.md');
          let body = rawText;
          let folderName = '未分类';

          // 提取 frontmatter
          const fmMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
          if (fmMatch) {
            const fmText = fmMatch[1];
            body = fmMatch[2];
            const titleMatch = fmText.match(/title:\s*"?(.*?)"?$/m);
            if (titleMatch) title = titleMatch[1];
            const folderMatch = fmText.match(/folder:\s*"?(.*?)"?$/m);
            if (folderMatch) folderName = folderMatch[1];
          }

          // 匹配或创建对应文件夹
          let folderRow = activeDb.prepare(`SELECT id FROM folders WHERE name = ?`).get(folderName) as any;
          let folderId = folderRow?.id || null;
          if (!folderId && folderName !== '未分类') {
            folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            activeDb.prepare(`
              INSERT INTO folders (id, name, created_at, updated_at)
              VALUES (?, ?, ?, ?)
            `).run(folderId, folderName, nowIso, nowIso);
            restoredFoldersCount++;
          }

          const contentJson = JSON.stringify({
            type: 'doc',
            content: body.split(/\n\n+/).filter(Boolean).map((para: string) => ({
              type: 'paragraph',
              content: [{ type: 'text', text: para.trim() }],
            })),
          });

          const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          activeDb.prepare(`
            INSERT INTO notes (id, folder_id, title, content_json, snippet, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(noteId, folderId, title, contentJson, body.slice(0, 100), nowIso, nowIso);
          restoredNotesCount++;
        }
      }
    }

    // 5. 提取并恢复实体附件
    const zipEntries = zip.getEntries();
    if (!fs.existsSync(config.storageDir)) {
      fs.mkdirSync(config.storageDir, { recursive: true });
    }

    for (const entry of zipEntries) {
      if (entry.entryName.startsWith('attachments/') && !entry.isDirectory) {
        const relPath = entry.entryName.replace(/^attachments\//, '');
        if (relPath) {
          const targetFile = path.resolve(config.storageDir, relPath);
          const targetDir = path.dirname(targetFile);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(targetFile, entry.getData());
          restoredAttachmentsCount++;
        }
      }
    }

    return {
      notesCount: restoredNotesCount,
      foldersCount: restoredFoldersCount,
      attachmentsCount: restoredAttachmentsCount,
    };
  }

  /**
   * 清理过期的备份压缩包
   */
  private static cleanOldBackups(keepCount = 5) {
    try {
      if (!fs.existsSync(this.backupsDir)) return;
      const files = fs.readdirSync(this.backupsDir)
        .filter((f) => f.startsWith('chuqing_backup_') && f.endsWith('.zip'))
        .map((f) => ({
          name: f,
          path: path.resolve(this.backupsDir, f),
          time: fs.statSync(path.resolve(this.backupsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > keepCount) {
        for (let i = keepCount; i < files.length; i++) {
          try {
            fs.unlinkSync(files[i].path);
          } catch {}
        }
      }
    } catch {}
  }

  /**
   * 启动后台每小时巡检定时器（用于每 3 天自动执行备份发信）
   */
  private static startScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);

    // 每 1 小时检查一次是否满足备份间隔
    this.schedulerTimer = setInterval(async () => {
      try {
        const cfg = this.getConfig();
        if (!cfg.autoBackupEnabled) return;

        const intervalDays = cfg.autoBackupIntervalDays || 3;
        const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

        const lastTime = cfg.lastBackupTime ? new Date(cfg.lastBackupTime).getTime() : 0;
        const now = Date.now();

        if (now - lastTime >= intervalMs) {
          console.log(`⏰ [BackupService] 到达 ${intervalDays} 天备份周期，开始自动生成备份并发送邮件...`);
          await this.runBackup(false);
          console.log(`✅ [BackupService] 周期自动备份完成`);
        }
      } catch (err: any) {
        console.error('❌ [BackupService] 周期自动备份异常:', err.message);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * 纯文本 Markdown 转换器
   */
  private static tiptapToMarkdown(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;

    let result = '';

    function parseNode(n: any): string {
      if (!n) return '';
      if (n.type === 'text') {
        let text = n.text || '';
        if (n.marks) {
          for (const m of n.marks) {
            if (m.type === 'bold') text = `**${text}**`;
            else if (m.type === 'italic') text = `*${text}*`;
            else if (m.type === 'code') text = `\`${text}\``;
            else if (m.type === 'strike') text = `~~${text}~~`;
            else if (m.type === 'link') text = `[${text}](${m.attrs?.href || ''})`;
          }
        }
        return text;
      }

      if (n.type === 'paragraph') {
        const text = (n.content || []).map(parseNode).join('');
        return `${text}\n\n`;
      }

      if (n.type === 'heading') {
        const level = n.attrs?.level || 1;
        const text = (n.content || []).map(parseNode).join('');
        return `${'#'.repeat(level)} ${text}\n\n`;
      }

      if (n.type === 'bulletList') {
        return (n.content || []).map((li: any) => `- ${(li.content || []).map(parseNode).join('').trim()}\n`).join('') + '\n';
      }

      if (n.type === 'orderedList') {
        return (n.content || []).map((li: any, idx: number) => `${idx + 1}. ${(li.content || []).map(parseNode).join('').trim()}\n`).join('') + '\n';
      }

      if (n.type === 'blockquote') {
        const text = (n.content || []).map(parseNode).join('').trim();
        return `> ${text}\n\n`;
      }

      if (n.type === 'codeBlock') {
        const lang = n.attrs?.language || '';
        const text = (n.content || []).map(parseNode).join('');
        return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
      }

      if (n.type === 'horizontalRule') {
        return `---\n\n`;
      }

      if (n.type === 'attachment') {
        const filename = n.attrs?.name || n.attrs?.fileName || 'attachment';
        const fileId = n.attrs?.id || n.attrs?.fileId || '';
        return `📎 [附件: ${filename}](attachments/${fileId})\n\n`;
      }

      if (Array.isArray(n.content)) {
        return n.content.map(parseNode).join('');
      }

      return '';
    }

    if (Array.isArray(node.content)) {
      result = node.content.map(parseNode).join('');
    } else {
      result = parseNode(node);
    }

    return result.trim();
  }
}
