<template>
  <aside class="w-64 h-full bg-slate-900 text-slate-300 flex flex-col justify-between flex-shrink-0 select-none border-r border-slate-800">
    <!-- 顶部 Brand 与新建 -->
    <div class="p-4 flex-1 overflow-y-auto">
      <!-- 品牌标题 -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2.5">
          <ChuqingLogo :size="32" variant="app" />
          <div>
            <div class="font-bold text-white text-base leading-tight tracking-wide">初晴笔记</div>
            <div class="text-[10px] text-sky-400 font-mono tracking-wider">CHU QING NOTE</div>
          </div>
        </div>
      </div>

      <!-- 新建笔记大按钮 -->
      <button
        type="button"
        @click="handleNewNote()"
        class="w-full mb-5 flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm rounded-xl shadow-lg shadow-sky-500/25 transition active:scale-[0.98]"
      >
        <Plus :size="18" />
        <span>新建笔记</span>
      </button>

      <!-- 快速视图分类 -->
      <div class="space-y-1 mb-6 text-sm font-medium">
        <!-- 全部笔记（支持拖拽移入以清除分类） -->
        <button
          type="button"
          @click="selectView('all')"
          @dragover.prevent="dragOverFolderId = 'all'"
          @dragleave="dragOverFolderId = null"
          @drop.prevent="handleDrop(null)"
          :class="[
            noteStore.currentView === 'all' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200',
            dragOverFolderId === 'all' ? 'border-2 border-dashed border-sky-400 bg-sky-950/80 text-sky-200' : ''
          ]"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition"
          title="拖拽笔记至此处可将其移为未分类"
        >
          <div class="flex items-center gap-2.5">
            <BookOpen :size="17" class="text-sky-400" />
            <span>全部笔记</span>
          </div>
        </button>

        <button
          type="button"
          @click="selectView('pinned')"
          :class="noteStore.currentView === 'pinned' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition"
        >
          <div class="flex items-center gap-2.5">
            <Pin :size="17" class="text-amber-400" />
            <span>置顶笔记</span>
          </div>
        </button>

        <button
          type="button"
          @click="selectView('trash')"
          :class="noteStore.currentView === 'trash' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'"
          class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition"
        >
          <div class="flex items-center gap-2.5">
            <Trash :size="17" class="text-rose-400" />
            <span>废纸篓</span>
          </div>
        </button>
      </div>

      <!-- 文件夹目录树 -->
      <div>
        <div class="flex items-center justify-between px-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>我的分类文件夹</span>
          <button type="button" @click="promptNewFolder" class="hover:text-sky-400 p-1 rounded transition" title="新建分类文件夹">
            <FolderPlus :size="15" />
          </button>
        </div>

        <div class="space-y-0.5 text-sm">
          <div
            v-for="folder in noteStore.folders"
            :key="folder.id"
            @dragover.prevent="dragOverFolderId = folder.id"
            @dragleave="dragOverFolderId = null"
            @drop.prevent="handleDrop(folder.id)"
            :class="[
              noteStore.currentView === folder.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200',
              dragOverFolderId === folder.id ? 'border-2 border-dashed border-sky-400 bg-sky-950/80 text-sky-200 scale-[1.02]' : ''
            ]"
            class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition group cursor-pointer"
            @click="selectView(folder.id)"
            :title="`拖拽笔记到此分类进行归档`"
          >
            <div class="flex items-center gap-2.5 truncate flex-1 min-w-0">
              <FolderIcon :size="16" class="text-slate-400 group-hover:text-sky-400 flex-shrink-0" />
              <span class="truncate">{{ folder.name }}</span>
            </div>

            <!-- 分类重命名与删除操作按钮 -->
            <div class="hidden group-hover:flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                @click.stop="promptRenameFolder(folder.id, folder.name)"
                class="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-700/60 transition"
                title="重命名分类"
              >
                <Pencil :size="12" />
              </button>
              <button
                type="button"
                @click.stop="confirmDeleteFolder(folder.id, folder.name)"
                class="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition"
                title="删除分类（笔记将自动归入未分类）"
              >
                <Trash2 :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 用户个人资料卡片 (模式 B：多账号) -->
    <div v-if="noteStore.currentUser" class="px-4 py-2.5 bg-slate-800/60 border-t border-slate-800 flex items-center justify-between text-xs">
      <div class="flex items-center gap-2 overflow-hidden">
        <div class="w-7 h-7 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
          {{ (noteStore.currentUser.nickname || noteStore.currentUser.username).slice(0, 1).toUpperCase() }}
        </div>
        <div class="truncate">
          <div class="font-semibold text-slate-200 truncate leading-tight">
            {{ noteStore.currentUser.nickname || noteStore.currentUser.username }}
          </div>
          <div class="text-[10px] text-sky-400/90 font-mono mt-0.5">
            @{{ noteStore.currentUser.username }} · {{ noteStore.currentUser.role === 'admin' ? '管理员' : '成员' }}
          </div>
        </div>
      </div>
      <button
        type="button"
        @click="noteStore.logout()"
        class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/60 transition"
        title="退出当前登录"
      >
        <LogOut :size="15" />
      </button>
    </div>

    <!-- 底部状态与设置 -->
    <div class="p-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        <span>NAS 数据连接就绪</span>
      </div>
      <button
        type="button"
        @click="$emit('openSettings')"
        class="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
        title="数据备份与系统设置"
      >
        <Settings :size="16" />
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Plus,
  BookOpen,
  Pin,
  Trash,
  FolderPlus,
  Folder as FolderIcon,
  Settings,
  LogOut,
  Pencil,
  Trash2
} from 'lucide-vue-next';
import ChuqingLogo from '../common/ChuqingLogo.vue';
import { useNoteStore } from '../../stores/noteStore';

const emit = defineEmits<{
  (e: 'closeDrawer'): void;
  (e: 'newNote'): void;
  (e: 'openSettings'): void;
}>();

const noteStore = useNoteStore();
const dragOverFolderId = ref<string | null>(null);

function selectView(view: string) {
  noteStore.currentView = view;
  noteStore.loadNotes();
  emit('closeDrawer');
}

function handleNewNote() {
  noteStore.createNewNote();
  emit('closeDrawer');
  emit('newNote');
}

async function promptNewFolder() {
  const name = prompt('请输入新分类文件夹名称：');
  if (name && name.trim()) {
    await noteStore.createFolder(name.trim());
  }
}

async function promptRenameFolder(id: string, currentName: string) {
  const newName = prompt('修改分类名称：', currentName);
  if (newName && newName.trim() && newName.trim() !== currentName) {
    await noteStore.renameFolder(id, newName.trim());
  }
}

async function confirmDeleteFolder(id: string, name: string) {
  if (confirm(`确定要删除分类【${name}】吗？\n\n安全提示：该分类下的所有笔记将自动转移至【未分类】，笔记正文与附件绝不会丢失。`)) {
    await noteStore.deleteFolder(id);
  }
}

async function handleDrop(folderId: string | null) {
  dragOverFolderId.value = null;
  const noteId = noteStore.draggedNoteId;
  if (noteId) {
    await noteStore.moveNoteToFolder(noteId, folderId);
    noteStore.draggedNoteId = null;
  }
}
</script>
