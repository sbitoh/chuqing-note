import { AttachmentCategory } from './types.js';

/**
 * 根据文件名或 MIME 类型识别附件大类
 */
export function getAttachmentCategory(mimeType: string, filename: string): AttachmentCategory {
  const mime = mimeType.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'epub'].includes(ext) ||
    mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.includes('officedocument')
  ) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return 'archive';
  }
  if (['js', 'ts', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'html', 'css', 'json', 'yaml', 'yml', 'sql', 'sh'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

/**
 * 格式化文件尺寸为人类可读字符串
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
