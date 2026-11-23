import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { Attachment, getAttachmentCategory } from '@chuqing/shared';

export interface UploadOptions {
  noteId?: string | null;
  filename: string;
  mimetype: string;
  fileStream: NodeJS.ReadableStream;
}

export class StorageService {
  /**
   * 流式保存上传的附件，并在写入过程中实时计算 SHA-256 哈希值
   * 若 NAS 存储池中已存在相同哈希文件，则自动去重复用
   */
  static async saveAttachment(options: UploadOptions): Promise<Attachment> {
    const db = getDb();
    const attachmentId = nanoid(16);
    const tempFilename = `temp_${attachmentId}_${Date.now()}.tmp`;
    const tempFilePath = path.join(config.storageDir, tempFilename);

    // 1. 创建流式写入与哈希校验管线
    const hashStream = crypto.createHash('sha256');
    const writeStream = fs.createWriteStream(tempFilePath);

    let totalBytes = 0;
    options.fileStream.on('data', (chunk) => {
      totalBytes += chunk.length;
      hashStream.update(chunk);
    });

    await pipeline(options.fileStream, writeStream);

    const fileHash = hashStream.digest('hex');
    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const relDir = path.join('files', yearMonth);
    const absDir = path.join(config.storageDir, relDir);

    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir, { recursive: true });
    }

    // 扩展名后缀
    const ext = path.extname(options.filename).toLowerCase();
    const finalFilename = `${fileHash}${ext ? ext : '.bin'}`;
    const relStoragePath = path.join(relDir, finalFilename);
    const absFinalPath = path.join(config.storageDir, relStoragePath);

    // 2. 检查 NAS 存储池中是否已有该哈希的物理文件 (去重)
    if (fs.existsSync(absFinalPath)) {
      // 物理文件已存在，直接安全清理临时文件
      fs.unlinkSync(tempFilePath);
    } else {
      // 首次出现，移动临时文件为永久存储
      fs.renameSync(tempFilePath, absFinalPath);
    }

    const category = getAttachmentCategory(options.mimetype, options.filename);
    const createdAt = now.toISOString();

    // 3. 记录元数据至数据库
    const stmt = db.prepare(`
      INSERT INTO attachments (
        id, note_id, original_name, mime_type, size, hash, storage_path, category, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      attachmentId,
      options.noteId || null,
      options.filename,
      options.mimetype,
      totalBytes,
      fileHash,
      relStoragePath,
      category,
      createdAt
    );

    return {
      id: attachmentId,
      noteId: options.noteId || null,
      originalName: options.filename,
      mimeType: options.mimetype,
      size: totalBytes,
      hash: fileHash,
      storagePath: relStoragePath,
      category,
      createdAt,
    };
  }

  /**
   * 根据 ID 获取附件详情
   */
  static getAttachmentById(id: string): Attachment | null {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      noteId: row.note_id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      hash: row.hash,
      storagePath: row.storage_path,
      category: row.category,
      width: row.width,
      height: row.height,
      duration: row.duration,
      createdAt: row.created_at,
    };
  }

  /**
   * 获取附件的物理绝对路径
   */
  static getAbsoluteFilePath(storagePath: string): string {
    return path.join(config.storageDir, storagePath);
  }

  /**
   * 获取某篇笔记所关联的所有附件
   */
  static getAttachmentsByNoteId(noteId: string): Attachment[] {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at DESC`).all(noteId) as any[];
    return rows.map((r) => ({
      id: r.id,
      noteId: r.note_id,
      originalName: r.original_name,
      mimeType: r.mime_type,
      size: r.size,
      hash: r.hash,
      storagePath: r.storage_path,
      category: r.category,
      createdAt: r.created_at,
    }));
  }

  /**
   * 关联未命名草稿附件至目标笔记
   */
  static bindAttachmentToNote(attachmentId: string, noteId: string): void {
    const db = getDb();
    db.prepare(`UPDATE attachments SET note_id = ? WHERE id = ?`).run(noteId, attachmentId);
  }
}
