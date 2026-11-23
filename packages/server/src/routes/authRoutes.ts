import { FastifyPluginAsync } from 'fastify';
import { AuthService } from '../services/auth.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // 检查系统当前状态与当前客户端登录态
  fastify.get('/api/auth/status', async (request) => {
    const hasUsers = AuthService.hasUsers();
    const authHeader = request.headers.authorization;
    let authenticated = false;
    let currentUser = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = AuthService.verifyToken(token);
      if (payload) {
        authenticated = true;
        currentUser = AuthService.getUserById(payload.userId);
      }
    }

    return {
      success: true,
      data: {
        hasUsers,
        authenticated,
        user: currentUser,
      },
    };
  });

  // 用户注册 (模式 B：多账号)
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, password, nickname } = (request.body as any) || {};
    try {
      const result = AuthService.register({ username, password, nickname });
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      reply.status(400);
      return {
        success: false,
        error: err.message || '注册失败',
      };
    }
  });

  // 用户登录 (用户名 + 密码)
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = (request.body as any) || {};
    try {
      const result = AuthService.login({ username, password });
      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      reply.status(401);
      return {
        success: false,
        error: err.message || '登录失败',
      };
    }
  });

  // 获取当前登录用户信息
  fastify.get('/api/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401);
      return { success: false, error: '未登录' };
    }
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    if (!payload) {
      reply.status(401);
      return { success: false, error: '登录已失效' };
    }
    const user = AuthService.getUserById(payload.userId);
    return { success: true, data: user };
  });
};
