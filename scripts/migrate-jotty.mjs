import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { parseHTML } from 'linkedom';
import MarkdownIt from 'markdown-it';
import { DOMParser } from 'prosemirror-model';
import { getSchema, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';

// 1. 设置 linkedom 全局 DOM 垫片，供 prosemirror-view 与 prosemirror-model 使用
const baseDom = parseHTML('<!DOCTYPE html><html><body></body></html>');
globalThis.window = baseDom.window;
globalThis.document = baseDom.document;
globalThis.navigator = baseDom.navigator;
globalThis.Node = baseDom.Node;
globalThis.Element = baseDom.Element;
globalThis.HTMLElement = baseDom.HTMLElement;

// 2. 自定义 Attachment 节点定义
const AttachmentExtension = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      id: { default: null },
      originalName: { default: '未命名附件' },
      size: { default: 0 },
      category: { default: 'other' },
      mimeType: { default: '' }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="attachment"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'attachment' }];
  }
});

// 3. 构建 Tiptap / ProseMirror 完整 Schema
const schema = getSchema([
  StarterKit.default || StarterKit,
  Table.default || Table,
  TableRow.default || TableRow,
  TableCell.default || TableCell,
  TableHeader.default || TableHeader,
  Underline.default || Underline,
  Highlight.default || Highlight,
  Link.default || Link,
  AttachmentExtension,
]);

// 4. 初始化 Markdown 解析器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: false,
});

// 路径配置（支持通过环境变量或参数传入）
const DB_PATH = process.env.CHU_QING_DB_PATH || process.argv[2] || './data/chuqing.db';
const STORAGE_DIR = process.env.CHU_QING_STORAGE_DIR || './data/storage';
const JOTTY_NOTES_DIR = process.env.JOTTY_NOTES_DIR || process.argv[3] || './jotty/notes';
const JOTTY_ATTACHMENTS_DIR = process.env.JOTTY_ATTACHMENTS_DIR || process.argv[4] || './jotty/attachments';
const TARGET_USERNAME = process.env.MIGRATE_USERNAME || process.argv[5] || 'admin';

async function main() {
  console.log('🚀 开始将 Jotty 笔记与附件无损迁移至初晴笔记 (ChuQing Note)...');

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`数据库不存在: ${DB_PATH}`);
  }

  const db = new Database(DB_PATH);

  // 获取目标用户，若指定用户不存在则自动选取首个已注册用户
  let user = db.prepare(`SELECT id, username FROM users WHERE username = ?`).get(TARGET_USERNAME);
  if (!user) {
    user = db.prepare(`SELECT id, username FROM users LIMIT 1`).get();
  }
  if (!user) {
    throw new Error('未找到可用用户，请确认管理员账号已在系统中初始化注册');
  }
  const userId = user.id;
  console.log(`👤 目标用户: ${user.username} (ID: ${userId})`);

  // 1. 建立或获取目标分类文件夹
  const categoriesDef = [
    { name: '电脑', icon: 'Folder', color: '#0ea5e9', order_num: 1 },
    { name: '工作', icon: 'Folder', color: '#8b5cf6', order_num: 2 },
    { name: '日常', icon: 'Folder', color: '#10b981', order_num: 3 },
    { name: '未分类', icon: 'Folder', color: '#64748b', order_num: 4 },
  ];

  const folderMap = new Map(); // name -> id

  const getFolderStmt = db.prepare(`SELECT id FROM folders WHERE name = ? AND user_id = ?`);
  const insertFolderStmt = db.prepare(`
    INSERT INTO folders (id, name, parent_id, icon, color, order_num, created_at, updated_at, user_id)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const cat of categoriesDef) {
    const existing = getFolderStmt.get(cat.name, userId);
    if (existing) {
      folderMap.set(cat.name, existing.id);
      console.log(`📁 存在文件夹: ${cat.name} (${existing.id})`);
    } else {
      const folderId = nanoid(16);
      insertFolderStmt.run(folderId, cat.name, cat.icon, cat.color, cat.order_num, now, now, userId);
      folderMap.set(cat.name, folderId);
      console.log(`✨ 创建文件夹: ${cat.name} (${folderId})`);
    }
  }

  // 2. 准备附件存储目录
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // 3. 扫描 Jotty 所有 markdown 笔记
  const mdFiles = [];
  function scan(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scan(full);
      } else if (item.endsWith('.md')) {
        mdFiles.push(full);
      }
    }
  }
  scan(JOTTY_NOTES_DIR);
  console.log(`📝 共发现 ${mdFiles.length} 篇 Jotty 笔记`);

  const insertNoteStmt = db.prepare(`
    INSERT INTO notes (
      id, user_id, folder_id, title, content_json, snippet,
      is_pinned, is_favorite, is_archived, is_deleted, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 1, ?, ?)
  `);

  const insertAttachmentStmt = db.prepare(`
    INSERT INTO attachments (
      id, user_id, note_id, original_name, mime_type, size, hash, storage_path, category, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let migratedCount = 0;
  let attachmentCount = 0;

  for (const file of mdFiles) {
    const rel = path.relative(JOTTY_NOTES_DIR, file);
    const parts = rel.split(path.sep);
    const catName = parts.length > 1 ? parts[0] : '未分类';
    const folderId = folderMap.get(catName === 'Uncategorized' ? '未分类' : catName) || folderMap.get('未分类');

    const fileContent = fs.readFileSync(file, 'utf8');
    const stat = fs.statSync(file);

    // 解析 Frontmatter
    const fmMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    let title = path.basename(file, '.md');
    let body = fileContent;
    let createdAt = stat.mtime.toISOString();
    let noteUuid = null;

    if (fmMatch) {
      const yaml = fmMatch[1];
      body = fmMatch[2];
      const titleMatch = yaml.match(/title:\s*(.*)/);
      if (titleMatch) title = titleMatch[1].trim().replace(/^['\"](.*)['\"]$/, '');
      const createdMatch = yaml.match(/createdAt:\s*(.*)/);
      if (createdMatch) createdAt = createdMatch[1].trim().replace(/^['\"](.*)['\"]$/, '');
      const uuidMatch = yaml.match(/uuid:\s*(.*)/);
      if (uuidMatch) noteUuid = uuidMatch[1].trim().replace(/^['\"](.*)['\"]$/, '');
    }

    const noteId = nanoid(16);
    const updatedAt = stat.mtime.toISOString();

    // 检查是否有附件引用 (例如 debian.txt)
    // 格式形如: [📎 debian.txt](/api/attachment/f9db1203-a673-4b4f-b382-3e65e84a75c3/debian.txt)
    const attachmentRegex = /\[📎\s*([^\]]+)\]\(\/api\/attachment\/([^/]+)\/([^)]+)\)/g;
    let match;
    let processedBody = body;

    while ((match = attachmentRegex.exec(body)) !== null) {
      const [fullMatch, origName, attachUuid, fileName] = match;
      const possibleAttachPath = path.join(JOTTY_ATTACHMENTS_DIR, attachUuid, fileName);
      const fallbackAttachPath = path.join(JOTTY_NOTES_DIR, 'files', fileName);

      let realAttachPath = null;
      if (fs.existsSync(possibleAttachPath)) {
        realAttachPath = possibleAttachPath;
      } else if (fs.existsSync(fallbackAttachPath)) {
        realAttachPath = fallbackAttachPath;
      }

      if (realAttachPath) {
        const fileBuf = fs.readFileSync(realAttachPath);
        const attachStat = fs.statSync(realAttachPath);
        const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
        const ext = path.extname(origName) || '.txt';
        const relDir = path.join('files', '2026/01');
        const absDir = path.join(STORAGE_DIR, relDir);
        if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

        const finalFilename = `${hash}${ext}`;
        const relStoragePath = path.join(relDir, finalFilename);
        const absStoragePath = path.join(STORAGE_DIR, relStoragePath);

        if (!fs.existsSync(absStoragePath)) {
          fs.copyFileSync(realAttachPath, absStoragePath);
        }

        const attachId = nanoid(16);
        const mimeType = 'text/plain';
        const category = 'code';

        insertAttachmentStmt.run(
          attachId,
          userId,
          noteId,
          origName,
          mimeType,
          attachStat.size,
          hash,
          relStoragePath,
          category,
          createdAt
        );
        attachmentCount++;

        // 替换为初晴笔记的万能附件胶囊 DOM 标签
        const capsuleHtml = `\n\n<div data-type="attachment" id="${attachId}" originalName="${origName}" size="${attachStat.size}" category="${category}" mimeType="${mimeType}"></div>\n\n`;
        processedBody = processedBody.replace(fullMatch, capsuleHtml);
      }
    }

    // 转换 Markdown 为 HTML
    const renderedHtml = md.render(processedBody);

    // 解析为 ProseMirror AST
    const docDom = parseHTML('<!DOCTYPE html><html><body>' + renderedHtml + '</body></html>');
    const pmDoc = DOMParser.fromSchema(schema).parse(docDom.document.body);
    const contentJson = JSON.stringify(pmDoc.toJSON());

    // 提取纯文本前 150 字作为摘要
    const plainText = docDom.document.body.textContent || '';
    const snippet = plainText.replace(/\s+/g, ' ').trim().slice(0, 150);

    // 插入数据库
    insertNoteStmt.run(
      noteId,
      userId,
      folderId,
      title,
      contentJson,
      snippet,
      createdAt,
      updatedAt
    );

    migratedCount++;
    console.log(`✅ [${migratedCount}/${mdFiles.length}] 迁移成功: [${catName}] ${title} (${snippet.slice(0, 30)}...)`);
  }

  console.log(`\n🎉 迁移全部完成！共迁移 ${migratedCount} 篇笔记，${attachmentCount} 个附件到初晴笔记。`);
}

main().catch((err) => {
  console.error('❌ 迁移失败:', err);
  process.exit(1);
});
