<template>
  <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none overflow-y-auto" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
      <!-- 弹窗标题栏 -->
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
            <Settings :size="18" />
          </div>
          <h2 class="text-base font-bold text-slate-800">系统与数据安全设置</h2>
        </div>
        <button
          type="button"
          @click="$emit('close')"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Tab 切换 -->
      <div class="px-6 pt-3 border-b border-slate-100 flex items-center gap-4 text-xs font-semibold">
        <button
          type="button"
          @click="activeTab = 'backup'"
          :class="activeTab === 'backup' ? 'text-sky-600 border-b-2 border-sky-500 pb-2.5' : 'text-slate-400 hover:text-slate-600 pb-2.5'"
          class="transition flex items-center gap-1.5"
        >
          <Mail :size="14" />
          <span>数据备份与邮箱推送</span>
        </button>
        <button
          type="button"
          @click="activeTab = 'restore'"
          :class="activeTab === 'restore' ? 'text-sky-600 border-b-2 border-sky-500 pb-2.5' : 'text-slate-400 hover:text-slate-600 pb-2.5'"
          class="transition flex items-center gap-1.5"
        >
          <RotateCcw :size="14" />
          <span>数据还原与恢复</span>
        </button>
        <button
          type="button"
          @click="activeTab = 'server'"
          :class="activeTab === 'server' ? 'text-sky-600 border-b-2 border-sky-500 pb-2.5' : 'text-slate-400 hover:text-slate-600 pb-2.5'"
          class="transition flex items-center gap-1.5"
        >
          <Server :size="14" />
          <span>服务端网络配置</span>
        </button>
      </div>

      <!-- 弹窗主内容区 -->
      <div class="p-6 overflow-y-auto max-h-[70vh] space-y-5 text-xs text-slate-700">
        <!-- 备份选项卡 -->
        <div v-if="activeTab === 'backup'" class="space-y-4">
          <!-- 立即备份操作区 -->
          <div class="p-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl border border-sky-100 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-bold text-sky-950 flex items-center gap-1.5">
                  <ShieldCheck :size="16" class="text-sky-600" />
                  <span>全量数据安全备份</span>
                </div>
                <div class="text-[11px] text-sky-700 mt-0.5">
                  一键打包 SQLite 数据库快照、纯文本 Markdown 镜像与全部文件附件
                </div>
              </div>
              <button
                type="button"
                @click="triggerBackupNow"
                :disabled="isBackingUp"
                class="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm shadow-sky-600/30 flex items-center gap-1.5 flex-shrink-0"
              >
                <Loader2 v-if="isBackingUp" :size="14" class="animate-spin" />
                <Download v-else :size="14" />
                <span>{{ isBackingUp ? '正在打包备份...' : '立即备份' }}</span>
              </button>
            </div>

            <!-- 备份执行提示或下载链接 -->
            <div v-if="backupResult" class="pt-2 border-t border-sky-200/60 flex items-center justify-between text-[11px]">
              <span class="text-emerald-700 font-medium flex items-center gap-1">
                <Check :size="13" /> {{ backupResult.message }}
              </span>
              <a
                v-if="backupResult.downloadUrl"
                :href="backupResult.downloadUrl"
                target="_blank"
                class="underline font-bold text-sky-700 hover:text-sky-900 ml-2"
              >
                点击直接下载压缩包 ({{ formatSize(backupResult.size) }})
              </a>
            </div>
          </div>

          <!-- 接收备份邮箱 -->
          <div class="space-y-1.5">
            <label class="block font-bold text-slate-800">
              接收备份的邮箱地址
            </label>
            <div class="relative">
              <input
                v-model="backupConfig.backupEmail"
                type="email"
                placeholder="例如: your-backup-box@example.com"
                class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none text-xs transition"
              />
              <Mail :size="15" class="absolute left-3 top-2.5 text-slate-400" />
            </div>
            <div class="text-[11px] text-slate-400">
              生成的全量备份压缩包将作为邮件附件直接发送至此邮箱。
            </div>
          </div>

          <!-- 自动备份周期选项 (自定义天数) -->
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock :size="14" class="text-sky-600" />
                  <span>定时自动备份与邮箱推送</span>
                </div>
                <div class="text-[11px] text-slate-400">
                  后台定时巡检，满足周期后静默生成全量备份并邮件直达
                </div>
              </div>
              <input
                v-model="backupConfig.autoBackupEnabled"
                type="checkbox"
                class="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 cursor-pointer"
              />
            </div>

            <div v-if="backupConfig.autoBackupEnabled" class="pt-2 border-t border-slate-200 flex items-center gap-3">
              <span class="text-slate-600 font-medium">执行周期:</span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  v-for="days in [1, 3, 7, 14, 30]"
                  :key="days"
                  @click="backupConfig.autoBackupIntervalDays = days"
                  :class="backupConfig.autoBackupIntervalDays === days ? 'bg-sky-600 text-white font-bold' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'"
                  class="px-2.5 py-1 rounded-lg text-xs transition"
                >
                  {{ days === 1 ? '每天' : `${days} 天` }}
                </button>
              </div>
              <div class="flex items-center gap-1 ml-auto">
                <span class="text-slate-400 text-[11px]">自定义:</span>
                <input
                  v-model.number="backupConfig.autoBackupIntervalDays"
                  type="number"
                  min="1"
                  max="365"
                  class="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono text-xs focus:border-sky-500 outline-none"
                />
                <span class="text-slate-500">天</span>
              </div>
            </div>
          </div>

          <!-- SMTP 发信服务器配置 -->
          <div class="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
            <div class="flex items-center justify-between border-b border-slate-100 pb-2">
              <div class="font-bold text-slate-800">发信邮箱配置 (SMTP)</div>
              <!-- 快捷预设按钮 -->
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="text-slate-400">快捷预设:</span>
                <button
                  type="button"
                  @click="applySmtpPreset('163')"
                  class="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                >
                  网易163
                </button>
                <button
                  type="button"
                  @click="applySmtpPreset('qq')"
                  class="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                >
                  QQ邮箱
                </button>
                <button
                  type="button"
                  @click="applySmtpPreset('gmail')"
                  class="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                >
                  Gmail
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-600 font-medium mb-1">SMTP 服务器</label>
                <input
                  v-model="backupConfig.smtpHost"
                  type="text"
                  placeholder="smtp.example.com"
                  class="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-sky-500 outline-none font-mono text-[11px]"
                />
              </div>
              <div class="flex gap-2">
                <div class="flex-1">
                  <label class="block text-slate-600 font-medium mb-1">端口</label>
                  <input
                    v-model.number="backupConfig.smtpPort"
                    type="number"
                    placeholder="465"
                    class="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-sky-500 outline-none font-mono text-[11px]"
                  />
                </div>
                <div class="w-24">
                  <label class="block text-slate-600 font-medium mb-1">SSL/TLS</label>
                  <select
                    v-model="backupConfig.smtpSecure"
                    class="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:border-sky-500 outline-none text-[11px] bg-white"
                  >
                    <option :value="true">开启 (465)</option>
                    <option :value="false">关闭 (587)</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-600 font-medium mb-1">发信账号 / 用户名</label>
                <input
                  v-model="backupConfig.smtpUser"
                  type="text"
                  placeholder="sender@example.com"
                  class="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-sky-500 outline-none font-mono text-[11px]"
                />
              </div>
              <div>
                <label class="block text-slate-600 font-medium mb-1">授权码 / 密码</label>
                <input
                  v-model="backupConfig.smtpPass"
                  type="password"
                  placeholder="邮箱授权码 (非登录密码)"
                  class="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:border-sky-500 outline-none font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          <!-- 上次备份状态记录 -->
          <div v-if="backupConfig.lastBackupTime" class="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
            <span>上次备份时间: {{ new Date(backupConfig.lastBackupTime).toLocaleString() }}</span>
            <span class="truncate max-w-[240px]">{{ backupConfig.lastBackupStatus || '完成' }}</span>
          </div>
        </div>

        <!-- 还原选项卡 -->
        <div v-else-if="activeTab === 'restore'" class="space-y-4">
          <!-- 安全保障提示 -->
          <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5 text-emerald-900 text-xs">
            <ShieldCheck :size="18" class="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div class="font-bold">安全还原保障</div>
              <div class="text-[11px] text-emerald-700 leading-relaxed mt-0.5">
                系统在每次执行数据还原前，均会自动在后台对当前知识库生成最新的安全快照，随时可逆回滚，确保笔记与数据万无一失。
              </div>
            </div>
          </div>

          <!-- 方式一：上传本地备份包还原 -->
          <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div class="font-bold text-slate-800 flex items-center gap-1.5">
              <Upload :size="15" class="text-sky-600" />
              <span>上传备份 Zip 压缩包还原</span>
            </div>
            <div class="text-[11px] text-slate-500 leading-relaxed">
              支持上传初晴笔记历史导出的全量备份包（.zip），或标准 Markdown 知识库压缩包。
            </div>
            <div class="flex items-center gap-3">
              <input
                ref="fileInputRef"
                type="file"
                accept=".zip"
                class="hidden"
                @change="handleFileSelected"
              />
              <button
                type="button"
                @click="triggerFileInput"
                :disabled="isRestoring"
                class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition flex items-center gap-1.5"
              >
                <FileArchive :size="14" />
                <span>{{ selectedFile ? selectedFile.name : '选择本地备份 Zip 文件...' }}</span>
              </button>
              <button
                type="button"
                v-if="selectedFile"
                @click="startUploadRestore"
                :disabled="isRestoring"
                class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
              >
                <Loader2 v-if="isRestoring" :size="14" class="animate-spin" />
                <RotateCcw v-else :size="14" />
                <span>{{ isRestoring ? '正在还原中...' : '开始还原' }}</span>
              </button>
            </div>
          </div>

          <!-- 方式二：从服务端历史备份中还原 -->
          <div class="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <div class="flex items-center justify-between">
              <div class="font-bold text-slate-800 flex items-center gap-1.5">
                <History :size="15" class="text-sky-600" />
                <span>从服务端历史备份一键还原</span>
              </div>
              <button
                type="button"
                @click="loadBackupHistory"
                class="text-[11px] text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <RefreshCw :size="12" :class="isLoadingHistory ? 'animate-spin' : ''" />
                <span>刷新</span>
              </button>
            </div>

            <div v-if="historyList.length === 0" class="text-center py-4 text-slate-400 text-xs">
              暂无服务端历史备份文件（可先点击“立即备份”生成一份）
            </div>

            <div v-else class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div
                v-for="item in historyList"
                :key="item.filename"
                class="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
              >
                <div class="truncate max-w-[260px]">
                  <div class="font-mono text-slate-800 font-medium truncate">{{ item.filename }}</div>
                  <div class="text-[10px] text-slate-400">
                    {{ new Date(item.createdAt).toLocaleString() }} · {{ formatSize(item.size) }}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <a
                    :href="item.downloadUrl"
                    target="_blank"
                    class="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] font-medium transition"
                  >
                    下载
                  </a>
                  <button
                    type="button"
                    @click="confirmRestoreFromHistory(item.filename)"
                    :disabled="isRestoring"
                    class="px-2.5 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                  >
                    <RotateCcw :size="11" />
                    <span>一键还原</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 还原执行结果提示 -->
          <div v-if="restoreStatusMessage" :class="restoreSuccess ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'" class="p-3 rounded-xl border text-xs flex items-center gap-2">
            <Check v-if="restoreSuccess" :size="16" class="text-emerald-600 flex-shrink-0" />
            <AlertCircle v-else :size="16" class="text-rose-600 flex-shrink-0" />
            <span>{{ restoreStatusMessage }}</span>
          </div>
        </div>

        <!-- 服务端设置选项卡 -->
        <div v-else-if="activeTab === 'server'" class="space-y-4">
          <div class="space-y-1.5">
            <label class="block font-bold text-slate-800">
              当前 NAS / 服务端接入地址
            </label>
            <input
              v-model="serverUrlInput"
              type="text"
              placeholder="https://notes.your-domain.com:3000"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-sky-500 outline-none font-mono text-xs"
            />
            <div class="text-[11px] text-slate-400">
              Web 端默认同源；原生 Android App 端通过该地址跨公网同步。
            </div>
          </div>

          <div v-if="testResult" :class="testResult.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'" class="p-2.5 rounded-xl border text-xs">
            {{ testResult.message }}
          </div>

          <button
            type="button"
            @click="testServerConnection"
            :disabled="isTestingServer"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <Loader2 v-if="isTestingServer" :size="13" class="animate-spin" />
            <Globe v-else :size="13" />
            <span>测试服务连接可用性</span>
          </button>
        </div>
      </div>

      <!-- 弹窗底部操作按钮 -->
      <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div class="text-[11px] text-slate-400">
          初晴笔记 · 私有云高可靠知识库
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="$emit('close')"
            class="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold transition"
          >
            关闭
          </button>
          <button
            v-if="activeTab !== 'restore'"
            type="button"
            @click="saveAllConfig"
            :disabled="isSaving"
            class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <Loader2 v-if="isSaving" :size="13" class="animate-spin" />
            <span>保存配置</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Settings,
  X,
  Mail,
  Server,
  ShieldCheck,
  Download,
  Loader2,
  Check,
  Clock,
  RotateCcw,
  Upload,
  History,
  FileArchive,
  RefreshCw,
  AlertCircle,
  Globe,
} from 'lucide-vue-next';
import { ApiClient, getServerUrl, setServerUrl } from '../../api/client';
import { useNoteStore } from '../../stores/noteStore';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const noteStore = useNoteStore();
const activeTab = ref<'backup' | 'restore' | 'server'>('backup');
const isSaving = ref(false);
const isBackingUp = ref(false);
const backupResult = ref<{ success: boolean; message: string; downloadUrl?: string; size?: number } | null>(null);

// 还原相关状态
const isRestoring = ref(false);
const restoreStatusMessage = ref('');
const restoreSuccess = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const historyList = ref<Array<{ filename: string; size: number; createdAt: string; downloadUrl: string }>>([]);
const isLoadingHistory = ref(false);

// 服务端网络测试状态
const isTestingServer = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);

const serverUrlInput = ref('');
const backupConfig = ref({
  backupEmail: '',
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  autoBackupEnabled: true,
  autoBackupIntervalDays: 3,
  lastBackupTime: null as string | null,
  lastBackupStatus: null as string | null,
});

onMounted(async () => {
  serverUrlInput.value = getServerUrl();
  try {
    const cfg = await ApiClient.getBackupConfig();
    if (cfg) {
      backupConfig.value = { ...backupConfig.value, ...cfg };
    }
  } catch (e) {
    console.error('加载备份配置失败:', e);
  }
  loadBackupHistory();
});

async function loadBackupHistory() {
  isLoadingHistory.value = true;
  try {
    historyList.value = await ApiClient.getBackupHistory();
  } catch (err: any) {
    console.error('获取备份历史失败:', err);
  } finally {
    isLoadingHistory.value = false;
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileSelected(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
  }
}

async function startUploadRestore() {
  if (!selectedFile.value) return;
  const ok = confirm(`确定要上传并还原【${selectedFile.value.name}】吗？\n系统将在还原前自动先备份当前数据。`);
  if (!ok) return;

  isRestoring.value = true;
  restoreStatusMessage.value = '';
  try {
    const res = await ApiClient.restoreFromUpload(selectedFile.value);
    restoreSuccess.value = true;
    restoreStatusMessage.value = res.message || '还原成功！';
    selectedFile.value = null;
    await noteStore.loadFolders();
    await noteStore.loadNotes();
    loadBackupHistory();
  } catch (err: any) {
    restoreSuccess.value = false;
    restoreStatusMessage.value = `还原失败: ${err.message}`;
  } finally {
    isRestoring.value = false;
  }
}

async function confirmRestoreFromHistory(filename: string) {
  const ok = confirm(`确定要将数据还原至【${filename}】吗？\n系统将在还原前自动先备份当前数据。`);
  if (!ok) return;

  isRestoring.value = true;
  restoreStatusMessage.value = '';
  try {
    const res = await ApiClient.restoreFromHistory(filename);
    restoreSuccess.value = true;
    restoreStatusMessage.value = res.message || '还原成功！';
    await noteStore.loadFolders();
    await noteStore.loadNotes();
    loadBackupHistory();
  } catch (err: any) {
    restoreSuccess.value = false;
    restoreStatusMessage.value = `还原失败: ${err.message}`;
  } finally {
    isRestoring.value = false;
  }
}

async function testServerConnection() {
  isTestingServer.value = true;
  testResult.value = null;
  try {
    testResult.value = await ApiClient.testConnection(serverUrlInput.value);
  } finally {
    isTestingServer.value = false;
  }
}

function applySmtpPreset(type: '163' | 'qq' | 'gmail') {
  if (type === '163') {
    backupConfig.value.smtpHost = 'smtp.163.com';
    backupConfig.value.smtpPort = 465;
    backupConfig.value.smtpSecure = true;
  } else if (type === 'qq') {
    backupConfig.value.smtpHost = 'smtp.qq.com';
    backupConfig.value.smtpPort = 465;
    backupConfig.value.smtpSecure = true;
  } else if (type === 'gmail') {
    backupConfig.value.smtpHost = 'smtp.gmail.com';
    backupConfig.value.smtpPort = 465;
    backupConfig.value.smtpSecure = true;
  }
}

async function triggerBackupNow() {
  isBackingUp.value = true;
  backupResult.value = null;
  try {
    const res = await ApiClient.triggerBackupNow();
    backupResult.value = res;
    const cfg = await ApiClient.getBackupConfig();
    if (cfg) backupConfig.value = { ...backupConfig.value, ...cfg };
    loadBackupHistory();
  } catch (err: any) {
    backupResult.value = {
      success: false,
      message: `备份失败: ${err.message || '未知异常'}`,
    };
  } finally {
    isBackingUp.value = false;
  }
}

async function saveAllConfig() {
  isSaving.value = true;
  try {
    // 1. 保存备份配置
    await ApiClient.saveBackupConfig(backupConfig.value);

    // 2. 保存服务器地址
    if (serverUrlInput.value && serverUrlInput.value.trim()) {
      setServerUrl(serverUrlInput.value.trim());
    }

    emit('close');
  } catch (err: any) {
    alert(`保存配置失败: ${err.message}`);
  } finally {
    isSaving.value = false;
  }
}

function formatSize(bytes?: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
</script>
