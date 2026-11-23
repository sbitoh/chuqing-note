<template>
  <div class="flex h-screen w-screen overflow-hidden bg-slate-50 relative">
    <!-- 1. 桌面端静态分类侧边栏 (md 以上可见) -->
    <Sidebar class="hidden md:flex" @open-settings="showSettings = true" />

    <!-- 2. 移动端抽屉侧边栏 (抽屉滑出层，带半透明遮罩) -->
    <div
      v-if="showMobileSidebar"
      class="fixed inset-0 z-40 md:hidden flex"
    >
      <!-- 背景遮罩 -->
      <div
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        @click="showMobileSidebar = false"
      ></div>

      <!-- 侧边栏主体 -->
      <div class="relative z-50 w-72 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
        <Sidebar
          @close-drawer="showMobileSidebar = false"
          @new-note="onMobileNewNote"
          @open-settings="showSettings = true; showMobileSidebar = false"
        />
      </div>
    </div>

    <!-- 3. 中间笔记摘要列表 -->
    <!-- 桌面端固定 flex 显示；移动端在 mobileView === 'list' 时全屏展示 -->
    <NoteList
      :class="[
        mobileView === 'list' ? 'flex w-full' : 'hidden',
        'md:flex md:w-80'
      ]"
      @open-sidebar="showMobileSidebar = true"
      @select-note="onMobileNoteSelected"
      @new-note="onMobileNewNote"
    />

    <!-- 4. 右侧主体富文本编辑区 -->
    <!-- 桌面端 flex-1 展示；移动端在 mobileView === 'editor' 时全屏展示 -->
    <main
      :class="[
        mobileView === 'editor' ? 'flex w-full' : 'hidden',
        'md:flex md:flex-1 h-full flex-col bg-white overflow-hidden relative'
      ]"
    >
      <template v-if="noteStore.activeNote">
        <!-- 废纸篓恢复与彻底删除横幅 -->
        <div v-if="noteStore.activeNote.isDeleted" class="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-700">
          <span class="flex items-center gap-1.5 font-medium">
            <Trash2 :size="14" />
            <span>当前笔记位于废纸篓中，处于只读归档状态</span>
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="noteStore.restoreActiveNote()"
              class="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition"
            >
              还原笔记
            </button>
            <button
              type="button"
              @click="handlePermanentDeleteActiveNote"
              class="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition"
            >
              彻底删除
            </button>
          </div>
        </div>

        <RichEditor
          class="flex-1"
          @back-to-list="mobileView = 'list'"
        />
      </template>

      <!-- 尚未选中任何笔记时的空状态 -->
      <div v-else class="h-full flex flex-col items-center justify-center text-slate-400 p-8">
        <ChuqingLogo :size="80" variant="symbol" class="mb-4" />
        <h3 class="text-lg font-bold text-slate-700 mb-1">初晴笔记</h3>
        <p class="text-xs text-slate-400 max-w-sm text-center mb-6">
          专为 NAS 与私有云打造的现代化、离线优先富文本笔记系统。
        </p>
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="mobileView = 'list'"
            class="md:hidden px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            查看笔记列表
          </button>
          <button
            type="button"
            @click="onMobileNewNote"
            class="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/20 transition"
          >
            新建笔记
          </button>
        </div>
      </div>
    </main>

    <!-- 全局 PDF 弹窗预览器 -->
    <PdfModal />

    <!-- 系统设置与邮箱备份弹窗 -->
    <SettingsModal
      v-if="showSettings"
      @close="showSettings = false"
    />

    <!-- 安全密码锁屏与初始化遮罩 -->
    <LockScreen
      v-if="!noteStore.authStatus.authenticated"
      :is-init="!noteStore.authStatus.initialized"
      @unlocked="onUnlocked"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import Sidebar from './components/layout/Sidebar.vue';
import NoteList from './components/layout/NoteList.vue';
import RichEditor from './components/editor/RichEditor.vue';
import PdfModal from './components/preview/PdfModal.vue';
import SettingsModal from './components/settings/SettingsModal.vue';
import ChuqingLogo from './components/common/ChuqingLogo.vue';
import LockScreen from './components/auth/LockScreen.vue';
import { useNoteStore } from './stores/noteStore';

const noteStore = useNoteStore();
const mobileView = ref<'list' | 'editor'>('list');
const showMobileSidebar = ref(false);
const showSettings = ref(false);

onMounted(async () => {
  const isAuthed = await noteStore.checkAuth();
  if (isAuthed) {
    await noteStore.loadFolders();
    await noteStore.loadNotes();
  }
});

async function onUnlocked() {
  await noteStore.loadFolders();
  await noteStore.loadNotes();
}

function onMobileNoteSelected() {
  mobileView.value = 'editor';
}

function onMobileNewNote() {
  noteStore.createNewNote();
  mobileView.value = 'editor';
  showMobileSidebar.value = false;
}

async function handlePermanentDeleteActiveNote() {
  if (!noteStore.activeNote) return;
  if (confirm('确定要彻底删除该笔记吗？此操作无法恢复！')) {
    await noteStore.permanentDeleteNote(noteStore.activeNote.id);
    mobileView.value = 'list';
  }
}
</script>
