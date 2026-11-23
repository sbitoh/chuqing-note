<template>
  <div class="w-full md:w-80 h-full border-r border-slate-200 bg-white flex flex-col flex-shrink-0 select-none" @click="activeFolderMenuNoteId = null">
    <!-- 头部与搜索栏 -->
    <div class="p-3 sm:p-4 border-b border-slate-100 flex-shrink-0">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2">
          <!-- 移动端侧边栏抽屉开关按钮 -->
          <button
            type="button"
            @click="$emit('openSidebar')"
            class="md:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="分类抽屉"
          >
            <Menu :size="19" />
          </button>
          <h2 class="text-base font-bold text-slate-800">{{ viewTitle }}</h2>
        </div>

        <div class="flex items-center gap-2">
          <!-- 废纸篓清空按钮 -->
          <button
            v-if="noteStore.currentView === 'trash' && noteStore.notes.length > 0"
            type="button"
            @click="handleEmptyTrash"
            class="text-[11px] px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold transition border border-rose-200"
            title="清空废纸篓中所有笔记"
          >
            清空废纸篓
          </button>

          <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
            {{ noteStore.notes.length }} 篇
          </span>

          <!-- 移动端右上角快捷新建按钮 -->
          <button
            v-if="noteStore.currentView !== 'trash'"
            type="button"
            @click="onNewNote"
            class="p-1.5 text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-sm shadow-sky-500/30 transition md:hidden"
            title="新建笔记"
          >
            <Plus :size="16" />
          </button>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="relative">
        <Search :size="15" class="absolute left-3 top-2.5 text-slate-400" />
        <input
          v-model="noteStore.searchQuery"
          @input="onSearchInput"
          type="text"
          placeholder="搜索笔记标题与内容..."
          class="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/70 focus:bg-white rounded-lg border border-transparent focus:border-sky-400 focus:outline-none transition"
        />
      </div>
    </div>

    <!-- 笔记滚动列表 -->
    <div class="flex-1 overflow-y-auto divide-y divide-slate-100">
      <div v-if="noteStore.isLoading" class="p-8 text-center text-xs text-slate-400">
        正在加载笔记...
      </div>
      <div v-else-if="noteStore.notes.length === 0" class="p-8 text-center text-xs text-slate-400">
        暂无相关笔记
      </div>
      <div
        v-else
        v-for="note in noteStore.notes"
        :key="note.id"
        @click="handleSelect(note.id)"
        draggable="true"
        @dragstart="handleDragStart($event, note.id)"
        @dragend="handleDragEnd"
        :class="noteStore.activeNote?.id === note.id ? 'bg-sky-50/80 border-l-4 border-sky-500' : 'hover:bg-slate-50'"
        class="p-3.5 cursor-pointer transition flex flex-col gap-1.5 relative group active:cursor-grabbing"
      >
        <!-- 标题行与右上角操作 -->
        <div class="flex items-center justify-between gap-2">
          <div class="font-semibold text-sm text-slate-800 truncate flex items-center gap-1.5 flex-1 min-w-0">
            <Pin v-if="note.isPinned" :size="13" class="text-amber-500 flex-shrink-0 fill-amber-500" />
            <span class="truncate">{{ note.title || '无标题笔记' }}</span>
          </div>

          <!-- 常态下显示时间，悬停或特定模式显示操作按钮 -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="text-[11px] text-slate-400 group-hover:hidden">
              {{ formatRelativeDate(note.updatedAt) }}
            </span>

            <!-- 废纸篓操作模式 -->
            <div v-if="noteStore.currentView === 'trash'" class="flex items-center gap-1">
              <button
                type="button"
                @click.stop="handleRestoreNote(note.id)"
                class="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition"
                title="还原笔记"
              >
                <RotateCcw :size="14" />
              </button>
              <button
                type="button"
                @click.stop="handlePermanentDelete(note.id)"
                class="p-1 rounded text-rose-500 hover:bg-rose-50 transition"
                title="彻底删除"
              >
                <Trash2 :size="14" />
              </button>
            </div>

            <!-- 正常操作按钮（置顶、移动分类、移入废纸篓） -->
            <div v-else class="hidden group-hover:flex items-center gap-0.5">
              <!-- 置顶切换 -->
              <button
                type="button"
                @click.stop="noteStore.togglePin(note.id)"
                :class="note.isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400 hover:text-amber-500'"
                class="p-1 rounded hover:bg-slate-200/60 transition"
                :title="note.isPinned ? '取消置顶' : '置顶笔记'"
              >
                <Pin :size="13" />
              </button>

              <!-- 移动分类 -->
              <div class="relative">
                <button
                  type="button"
                  @click.stop="toggleFolderMenu(note.id)"
                  class="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-slate-200/60 transition"
                  title="移动到分类"
                >
                  <FolderInput :size="13" />
                </button>

                <!-- 分类选择弹窗 -->
                <div
                  v-if="activeFolderMenuNoteId === note.id"
                  @click.stop
                  class="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                >
                  <div class="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase border-b border-slate-100">
                    移动到分类
                  </div>
                  <button
                    type="button"
                    @click="handleMoveNote(note.id, null)"
                    :class="!note.folderId ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'"
                    class="w-full text-left px-3 py-1.5 flex items-center gap-2 transition"
                  >
                    <FolderMinus :size="13" class="text-slate-400" />
                    <span>移出分类 (未分类)</span>
                  </button>
                  <button
                    v-for="folder in noteStore.folders"
                    :key="folder.id"
                    type="button"
                    @click="handleMoveNote(note.id, folder.id)"
                    :class="note.folderId === folder.id ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'"
                    class="w-full text-left px-3 py-1.5 flex items-center gap-2 transition"
                  >
                    <Folder :size="13" class="text-sky-500" />
                    <span class="truncate">{{ folder.name }}</span>
                  </button>
                </div>
              </div>

              <!-- 移入废纸篓 -->
              <button
                type="button"
                @click.stop="handleDeleteNote(note.id)"
                class="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
                title="移入废纸篓"
              >
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>

        <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {{ note.snippet || '暂无详细内容...' }}
        </p>

        <!-- 底部元信息与所属分类徽标 -->
        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <!-- 分类标签（点击也可触发移动） -->
          <button
            v-if="getFolder(note.folderId)"
            type="button"
            @click.stop="toggleFolderMenu(note.id)"
            class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 transition"
            title="点击更改分类"
          >
            <Folder :size="10" />
            <span>{{ getFolder(note.folderId)?.name }}</span>
          </button>

          <!-- 附件数 -->
          <span
            v-if="note.attachmentCount && note.attachmentCount > 0"
            class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
          >
            <Paperclip :size="10" />
            <span>{{ note.attachmentCount }} 个附件</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Search,
  Pin,
  Paperclip,
  Menu,
  Plus,
  Trash2,
  RotateCcw,
  FolderInput,
  FolderMinus,
  Folder
} from 'lucide-vue-next';
import { useNoteStore } from '../../stores/noteStore';

const emit = defineEmits<{
  (e: 'openSidebar'): void;
  (e: 'selectNote', id: string): void;
  (e: 'newNote'): void;
}>();

const noteStore = useNoteStore();
const activeFolderMenuNoteId = ref<string | null>(null);

let searchTimer: any = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    noteStore.loadNotes();
  }, 300);
}

function handleSelect(id: string) {
  noteStore.selectNote(id);
  emit('selectNote', id);
}

function handleDragStart(event: DragEvent, noteId: string) {
  noteStore.draggedNoteId = noteId;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', noteId);
    event.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragEnd() {
  setTimeout(() => {
    noteStore.draggedNoteId = null;
  }, 200);
}

function onNewNote() {
  noteStore.createNewNote();
  emit('newNote');
}

function getFolder(folderId: string | null | undefined) {
  if (!folderId) return null;
  return noteStore.folders.find((f) => f.id === folderId) || null;
}

function toggleFolderMenu(noteId: string) {
  if (activeFolderMenuNoteId.value === noteId) {
    activeFolderMenuNoteId.value = null;
  } else {
    activeFolderMenuNoteId.value = noteId;
  }
}

async function handleMoveNote(noteId: string, folderId: string | null) {
  activeFolderMenuNoteId.value = null;
  await noteStore.moveNoteToFolder(noteId, folderId);
}

async function handleDeleteNote(noteId: string) {
  if (confirm('确定要将该笔记移入废纸篓吗？')) {
    await noteStore.deleteNote(noteId);
  }
}

async function handleRestoreNote(noteId: string) {
  await noteStore.restoreNote(noteId);
}

async function handlePermanentDelete(noteId: string) {
  if (confirm('此操作将彻底删除此笔记及其附件，且无法恢复，是否确定？')) {
    await noteStore.permanentDeleteNote(noteId);
  }
}

async function handleEmptyTrash() {
  if (confirm('确定要清空废纸篓中的所有笔记吗？此操作不可逆！')) {
    await noteStore.emptyTrash();
  }
}

const viewTitle = computed(() => {
  if (noteStore.currentView === 'all') return '全部笔记';
  if (noteStore.currentView === 'pinned') return '置顶笔记';
  if (noteStore.currentView === 'trash') return '废纸篓';
  if (noteStore.currentFolder) return noteStore.currentFolder.name;
  return '笔记列表';
});

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
  if (diffDays === 0) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } else if (diffDays === 1) {
    return '昨天';
  } else {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}
</script>
