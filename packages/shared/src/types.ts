/**
 * 初晴笔记 (ChuQing Note) - 共享数据结构契约与类型定义
 */

export interface User {
  id: string;
  username: string;
  nickname?: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export type AttachmentCategory = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'pdf' 
  | 'document' 
  | 'archive' 
  | 'code' 
  | 'other';

export interface Attachment {
  id: string;
  userId?: string | null;
  noteId?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string; // SHA-256 哈希，用于 NAS 物理磁盘去重
  storagePath: string; // 实际在 NAS 存储池中的相对路径
  category: AttachmentCategory;
  width?: number; // 图片/视频宽度
  height?: number; // 图片/视频高度
  duration?: number; // 音频/视频时长（秒）
  createdAt: string;
}

export interface Folder {
  id: string;
  userId?: string | null;
  name: string;
  parentId: string | null;
  icon?: string;
  color?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  userId?: string | null;
  folderId: string | null;
  title: string;
  /**
   * Tiptap / ProseMirror 结构化 JSON 文档 (抽象语法树 AST)
   * 包含富文本节点以及自定义的 AttachmentNode 胶囊卡片
   */
  content: Record<string, any>;
  /**
   * 纯文本摘要，用于搜索与列表快速预览
   */
  snippet: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  version: number; // 递增版本号，用于离线冲突检测
  createdAt: string;
  updatedAt: string;
}

export interface NoteListItem {
  id: string;
  folderId: string | null;
  title: string;
  snippet: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  updatedAt: string;
  attachmentCount?: number;
}

export interface SyncPushPayload {
  lastSyncTimestamp: number;
  notes: Note[];
  folders: Folder[];
}

export interface SyncPullResponse {
  serverTimestamp: number;
  notes: Note[];
  folders: Folder[];
  deletedNoteIds: string[];
  deletedFolderIds: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
