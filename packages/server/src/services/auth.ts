import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { User } from '@chuqing/shared';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  exp: number;
}

export class AuthService {
  /**
   * 检查系统中是否已有注册用户
   */
  static hasUsers(): boolean {
    const db = getDb();
    const row = db.prepare(`SELECT COUNT(*) as count FROM users`).get() as any;
    return !!row && row.count > 0;
  }

  /**
   * 用户注册（模式 B：多账号模式）
   * 系统首位注册者自动成为管理员 (Admin)
   */
  static register(data: { username: string; password: string; nickname?: string }): { token: string; user: User } {
    const db = getDb();
    const username = data.username.trim().toLowerCase();
    const nickname = data.nickname?.trim() || data.username.trim();

    if (!username || username.length < 3) {
      throw new Error('用户名长度至少为 3 位');
    }
    if (!data.password || data.password.length < 4) {
      throw new Error('密码长度至少为 4 位');
    }

    // 检查用户名冲突
    const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username) as any;
    if (existing) {
      throw new Error('该用户名已被注册，请更换');
    }

    // 首位注册者为管理员
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM users`).get() as any;
    const isFirstUser = !countRow || countRow.count === 0;
    const role: 'admin' | 'user' = isFirstUser ? 'admin' : 'user';

    const userId = nanoid(16);
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(data.password, salt, 64).toString('hex');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, password_hash, password_salt, nickname, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, hash, salt, nickname, role, now, now);

    // 如果是首位管理员，自动将系统内历史无归属的示例笔记/文件夹接管至该用户
    if (isFirstUser) {
      db.prepare(`UPDATE notes SET user_id = ? WHERE user_id IS NULL`).run(userId);
      db.prepare(`UPDATE folders SET user_id = ? WHERE user_id IS NULL`).run(userId);
      db.prepare(`UPDATE attachments SET user_id = ? WHERE user_id IS NULL`).run(userId);
    }

    const user: User = {
      id: userId,
      username,
      nickname,
      role,
      createdAt: now,
    };

    const token = this.generateToken(user);
    return { token, user };
  }

  /**
   * 用户名 + 密码登录
   */
  static login(data: { username: string; password: string }): { token: string; user: User } {
    const db = getDb();
    const username = data.username.trim().toLowerCase();

    const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
    if (!row) {
      throw new Error('用户名或密码错误');
    }

    const computedHash = crypto.scryptSync(data.password, row.password_salt, 64).toString('hex');
    const isMatch = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(row.password_hash, 'hex'));

    if (!isMatch) {
      throw new Error('用户名或密码错误');
    }

    const user: User = {
      id: row.id,
      username: row.username,
      nickname: row.nickname || row.username,
      role: row.role || 'user',
      createdAt: row.created_at,
    };

    const token = this.generateToken(user);
    return { token, user };
  }

  /**
   * 根据 ID 查询用户安全信息
   */
  static getUserById(userId: string): User | null {
    const db = getDb();
    const row = db.prepare(`SELECT id, username, nickname, role, created_at FROM users WHERE id = ?`).get(userId) as any;
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      nickname: row.nickname || row.username,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  /**
   * 获取或初始化 JWT 签名私钥
   */
  private static getSecret(): string {
    const db = getDb();
    let row = db.prepare(`SELECT value FROM system_config WHERE key = 'jwt_secret'`).get() as any;
    if (!row || !row.value) {
      const secret = crypto.randomBytes(32).toString('hex');
      db.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('jwt_secret', ?)`).run(secret);
      return secret;
    }
    return row.value;
  }

  /**
   * 签发携带用户身份的 JWT 令牌 (30 天有效)
   */
  static generateToken(user: User): string {
    const secret = this.getSecret();
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 1000 * 3600 * 24 * 30, // 30 天
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    return `${payloadStr}.${signature}`;
  }

  /**
   * 校验 Token 并解析出当前用户信息
   */
  static verifyToken(token: string): TokenPayload | null {
    if (!token || !token.includes('.')) return null;
    const [payloadStr, signature] = token.split('.');
    const secret = this.getSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    if (signature !== expectedSig) return null;

    try {
      const payload: TokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
      if (Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
