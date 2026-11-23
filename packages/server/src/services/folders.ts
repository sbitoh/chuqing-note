import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';
import { Folder } from '@chuqing/shared';

export class FoldersService {
  static listFolders(userId: string): Folder[] {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM folders WHERE user_id = ? OR user_id IS NULL ORDER BY order_num ASC, created_at ASC`).all(userId) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      parentId: r.parent_id,
      icon: r.icon,
      color: r.color,
      order: r.order_num,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  static createFolder(userId: string, name: string, parentId: string | null = null, icon?: string, color?: string): Folder {
    const db = getDb();
    const id = nanoid(12);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO folders (id, user_id, name, parent_id, icon, color, order_num, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, userId, name, parentId, icon || null, color || null, now, now);

    return {
      id,
      userId,
      name,
      parentId,
      icon,
      color,
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  static updateFolder(id: string, userId: string, data: Partial<Folder>): Folder | null {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM folders WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).get(id, userId) as any;
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = data.name !== undefined ? data.name : existing.name;
    const parentId = data.parentId !== undefined ? data.parentId : existing.parent_id;
    const icon = data.icon !== undefined ? data.icon : existing.icon;
    const color = data.color !== undefined ? data.color : existing.color;
    const order = data.order !== undefined ? data.order : existing.order_num;

    db.prepare(`
      UPDATE folders SET name = ?, parent_id = ?, icon = ?, color = ?, order_num = ?, updated_at = ?
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `).run(name, parentId, icon, color, order, now, id, userId);

    return {
      id,
      userId,
      name,
      parentId,
      icon,
      color,
      order,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  static deleteFolder(id: string, userId: string): boolean {
    const db = getDb();
    db.prepare(`UPDATE notes SET folder_id = NULL WHERE folder_id = ? AND (user_id = ? OR user_id IS NULL)`).run(id, userId);
    const res = db.prepare(`DELETE FROM folders WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(id, userId);
    return res.changes > 0;
  }
}
