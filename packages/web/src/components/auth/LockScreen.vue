<template>
  <div class="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 select-none overflow-y-auto">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 border border-slate-100 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 my-auto">
      <!-- 笔记本精美图标 -->
      <div class="mb-3 drop-shadow-md">
        <ChuqingLogo :size="72" variant="app" />
      </div>

      <h1 class="text-2xl font-black text-slate-900 tracking-wide mb-1">初晴笔记</h1>

      <!-- 阶段 1: 服务端未连接或需要配置 -->
      <div v-if="screenState === 'server_setup'" class="w-full space-y-4 animate-in fade-in duration-200">
        <div class="text-center">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold mb-2">
            <Server :size="13" />
            <span>第 1 步：连接私有云服务器</span>
          </div>
          <p class="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            初晴笔记是私有化知识库，数据完全由您掌控。首次在移动端使用，请先输入您的服务端地址。
          </p>
        </div>

        <div class="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1.5">NAS / 私有云服务端地址</label>
            <div class="relative">
              <input
                v-model="serverUrlInput"
                type="text"
                placeholder="例如: https://notes.your-domain.com:3000"
                class="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition font-mono"
              />
              <Globe :size="15" class="absolute left-2.5 top-3 text-slate-400" />
            </div>
            <div class="text-[11px] text-slate-400 mt-1">
              外网支持公网域名，局域网支持内网 IP (如 http://192.168.1.100:3000)
            </div>
          </div>

          <div v-if="testResult" :class="testResult.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'" class="p-2.5 rounded-xl border text-xs leading-relaxed flex items-center gap-1.5">
            <CheckCircle2 v-if="testResult.ok" :size="15" class="flex-shrink-0" />
            <AlertCircle v-else :size="15" class="flex-shrink-0" />
            <span>{{ testResult.message }}</span>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              @click="testServerConnection"
              :disabled="isTesting"
              class="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 active:scale-[0.98] text-slate-700 font-semibold rounded-xl transition flex items-center justify-center gap-1.5 text-xs"
            >
              <Loader2 v-if="isTesting" :size="14" class="animate-spin" />
              <Globe v-else :size="14" />
              <span>测试连接</span>
            </button>

            <button
              type="button"
              @click="connectAndProceed"
              :disabled="isConnecting"
              class="flex-1 py-2 px-3 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-white font-semibold rounded-xl transition shadow-md shadow-sky-500/25 flex items-center justify-center gap-1.5 text-xs"
            >
              <Loader2 v-if="isConnecting" :size="14" class="animate-spin" />
              <span>连接并继续</span>
              <ArrowRight v-if="!isConnecting" :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- 阶段 2: 服务端已连接，进行账号登录或首次初始化 -->
      <div v-else class="w-full space-y-4 animate-in fade-in duration-200">
        <!-- 当前服务器连接状态与快速切换栏 -->
        <div class="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-xl text-xs text-slate-600">
          <div class="flex items-center gap-1.5 truncate max-w-[240px]">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
            <span class="font-mono text-[11px] truncate text-slate-700">{{ activeServerDisplay }}</span>
          </div>
          <button
            type="button"
            @click="switchToChangeServer"
            class="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 ml-2 flex-shrink-0"
          >
            <span>修改服务地址</span>
          </button>
        </div>

        <p class="text-xs text-slate-400 text-center">
          {{ !noteStore.authStatus.hasUsers ? '首次使用此服务器，请创建首个系统管理员账号' : '专为 NAS 与私有云打造的富文本知识库' }}
        </p>

        <!-- 已有用户时的 Tab 切换 -->
        <div v-if="noteStore.authStatus.hasUsers" class="flex items-center w-full bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            @click="activeTab = 'login'; errorMessage = ''"
            :class="activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            class="flex-1 py-1.5 rounded-lg transition"
          >
            账号登录
          </button>
          <button
            type="button"
            @click="activeTab = 'register'; errorMessage = ''"
            :class="activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            class="flex-1 py-1.5 rounded-lg transition"
          >
            注册新账号
          </button>
        </div>

        <!-- 登录 / 注册表单 -->
        <form @submit.prevent="handleSubmit" class="w-full space-y-3">
          <!-- 用户名 -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">用户名</label>
            <div class="relative">
              <input
                v-model="username"
                type="text"
                placeholder="请输入登录用户名..."
                required
                autofocus
                class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none text-sm transition"
              />
              <UserIcon :size="16" class="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <!-- 昵称 (注册或首个管理员模式下) -->
          <div v-if="!noteStore.authStatus.hasUsers || activeTab === 'register'">
            <label class="block text-xs font-semibold text-slate-700 mb-1">个性昵称 (选填)</label>
            <input
              v-model="nickname"
              type="text"
              placeholder="例如：初晴 / 管理员"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none text-sm transition"
            />
          </div>

          <!-- 密码 -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">密码</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码..."
                required
                class="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none text-sm transition"
              />
              <Lock :size="16" class="absolute left-3 top-3 text-slate-400" />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <Eye v-if="showPassword" :size="17" />
                <EyeOff v-else :size="17" />
              </button>
            </div>
          </div>

          <!-- 确认密码 (注册或首个管理员模式下) -->
          <div v-if="!noteStore.authStatus.hasUsers || activeTab === 'register'">
            <label class="block text-xs font-semibold text-slate-700 mb-1">确认密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入以确认"
              required
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none text-sm transition"
            />
          </div>

          <!-- 错误提示 -->
          <div v-if="errorMessage" class="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg text-center animate-shake">
            {{ errorMessage }}
          </div>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/25 transition flex items-center justify-center gap-2 mt-2"
          >
            <Loader2 v-if="isSubmitting" :size="16" class="animate-spin" />
            <UserPlus v-else-if="!noteStore.authStatus.hasUsers || activeTab === 'register'" :size="16" />
            <LogIn v-else :size="16" />
            <span>{{ buttonLabel }}</span>
          </button>
        </form>
      </div>

      <div class="mt-4 text-[11px] text-slate-400 text-center">
        端到端私有数据隔离 · PBKDF2/Scrypt 加盐哈希加密
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Loader2,
  Globe,
  Server,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next';
import ChuqingLogo from '../common/ChuqingLogo.vue';
import { useNoteStore } from '../../stores/noteStore';
import { getServerUrl, setServerUrl, isNativePlatform, ApiClient } from '../../api/client';

const emit = defineEmits<{
  (e: 'unlocked'): void;
}>();

const noteStore = useNoteStore();
const screenState = ref<'server_setup' | 'auth_form'>('auth_form');
const activeTab = ref<'login' | 'register'>('login');
const username = ref('');
const nickname = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');

// 服务器设置
const serverUrlInput = ref('');
const isTesting = ref(false);
const isConnecting = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);

onMounted(async () => {
  const currentUrl = getServerUrl();
  serverUrlInput.value = currentUrl;

  // 1. 如果在原生 App 上，且尚未配置服务器地址，直接进入「连接服务器引导」页面
  if (isNativePlatform() && !currentUrl) {
    screenState.value = 'server_setup';
    return;
  }

  // 2. 检查现有配置连接状态
  try {
    const isAuthed = await noteStore.checkAuth();
    if (isAuthed) {
      emit('unlocked');
    } else {
      // 检查连接是否成功
      const probe = await ApiClient.testConnection();
      if (!probe.ok && isNativePlatform()) {
        screenState.value = 'server_setup';
      } else {
        screenState.value = 'auth_form';
      }
    }
  } catch {
    if (isNativePlatform()) {
      screenState.value = 'server_setup';
    }
  }
});

const activeServerDisplay = computed(() => {
  return getServerUrl() || (isNativePlatform() ? '未配置' : '当前站点网页');
});

const isRegisterMode = computed(() => {
  return !noteStore.authStatus.hasUsers || activeTab.value === 'register';
});

const buttonLabel = computed(() => {
  if (!noteStore.authStatus.hasUsers) return '创建管理员并进入';
  return activeTab.value === 'login' ? '登录初晴笔记' : '注册新账号';
});

function switchToChangeServer() {
  serverUrlInput.value = getServerUrl();
  testResult.value = null;
  screenState.value = 'server_setup';
}

async function testServerConnection() {
  if (!serverUrlInput.value.trim()) {
    testResult.value = { ok: false, message: '请先输入服务器地址' };
    return;
  }
  isTesting.value = true;
  testResult.value = null;
  try {
    const res = await ApiClient.testConnection(serverUrlInput.value.trim());
    testResult.value = res;
  } finally {
    isTesting.value = false;
  }
}

async function connectAndProceed() {
  const targetUrl = serverUrlInput.value.trim();
  if (!targetUrl) {
    testResult.value = { ok: false, message: '请先输入服务器地址' };
    return;
  }

  isConnecting.value = true;
  testResult.value = null;
  try {
    const probe = await ApiClient.testConnection(targetUrl);
    if (!probe.ok) {
      testResult.value = probe;
      return;
    }

    // 保存该服务器地址
    setServerUrl(targetUrl);

    // 重新获取真实的鉴权状态
    await noteStore.checkAuth();

    // 切换至登录界面
    screenState.value = 'auth_form';
  } catch (err: any) {
    testResult.value = { ok: false, message: `连接失败: ${err.message}` };
  } finally {
    isConnecting.value = false;
  }
}

async function handleSubmit() {
  errorMessage.value = '';
  if (!username.value || !password.value) return;

  if (isRegisterMode.value) {
    if (password.value !== confirmPassword.value) {
      errorMessage.value = '两次输入的密码不一致，请重试';
      return;
    }
  }

  isSubmitting.value = true;
  try {
    if (isRegisterMode.value) {
      await noteStore.register({
        username: username.value,
        password: password.value,
        nickname: nickname.value || undefined,
      });
    } else {
      await noteStore.login({
        username: username.value,
        password: password.value,
      });
    }
    emit('unlocked');
  } catch (err: any) {
    errorMessage.value = err.message || '操作失败，请重试';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
