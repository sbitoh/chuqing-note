import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const STORAGE_DIR = path.resolve(DATA_DIR, 'storage');
const DB_PATH = path.resolve(DATA_DIR, 'chuqing.db');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 确保存储目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export const config = {
  port: PORT,
  host: HOST,
  dataDir: DATA_DIR,
  storageDir: STORAGE_DIR,
  dbPath: DB_PATH,
  maxFileSize: 1024 * 1024 * 500, // 默认单文件上限 500MB (可调)
};
