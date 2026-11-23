<template>
  <div class="h-full flex flex-col bg-white overflow-hidden relative" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop" @click="closePopovers">
    <!-- 拖拽上传全屏提示遮罩 -->
    <div
      v-if="isDragging"
      class="absolute inset-0 z-50 bg-sky-500/10 backdrop-blur-[2px] border-2 border-dashed border-sky-500 rounded-xl flex flex-col items-center justify-center pointer-events-none"
    >
      <UploadCloud :size="48" class="text-sky-600 animate-bounce mb-2" />
      <div class="text-base font-semibold text-sky-800">松开鼠标将附件插入当前笔记</div>
      <div class="text-xs text-sky-600 mt-1">支持图片、文档、音频、视频、PDF、压缩包等各种格式</div>
    </div>

    <!-- 顶部富文本专业级排版工具栏 -->
    <div class="flex-shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur px-3 py-1.5 flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 text-slate-700 text-xs select-none">
      <div class="flex flex-wrap items-center gap-0.5">
        <!-- 移动端返回笔记列表按钮 -->
        <button
          type="button"
          @click="$emit('backToList')"
          class="md:hidden flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition mr-1"
          title="返回笔记列表"
        >
          <ChevronLeft :size="15" />
          <span>列表</span>
        </button>
        <div class="w-[1px] h-4 bg-slate-200 mx-1 md:hidden"></div>

        <!-- 1. 撤销 / 重做 -->
        <button
          type="button"
          @click="editor?.chain().focus().undo().run()"
          :disabled="!editor?.can().undo()"
          class="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="撤销 (Ctrl+Z)"
        >
          <Undo :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().redo().run()"
          :disabled="!editor?.can().redo()"
          class="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="重做 (Ctrl+Y)"
        >
          <Redo :size="15" />
        </button>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 2. 段落与标题样式切换 -->
        <div class="relative inline-block text-left">
          <button
            type="button"
            @click.stop="toggleHeadingMenu"
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition font-medium"
            title="段落与标题"
          >
            <span>{{ currentHeadingLabel }}</span>
            <ChevronDown :size="12" />
          </button>
          <div
            v-if="showHeadingMenu"
            class="absolute left-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50"
          >
            <button
              type="button"
              @click="setBlockType('p')"
              :class="{ 'bg-sky-50 text-sky-700 font-semibold': editor?.isActive('paragraph') }"
              class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition"
            >
              正文 (P)
            </button>
            <button
              type="button"
              @click="setBlockType('h1')"
              :class="{ 'bg-sky-50 text-sky-700 font-semibold': editor?.isActive('heading', { level: 1 }) }"
              class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition text-base font-bold"
            >
              一级标题 (H1)
            </button>
            <button
              type="button"
              @click="setBlockType('h2')"
              :class="{ 'bg-sky-50 text-sky-700 font-semibold': editor?.isActive('heading', { level: 2 }) }"
              class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition text-sm font-bold"
            >
              二级标题 (H2)
            </button>
            <button
              type="button"
              @click="setBlockType('h3')"
              :class="{ 'bg-sky-50 text-sky-700 font-semibold': editor?.isActive('heading', { level: 3 }) }"
              class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition text-xs font-bold"
            >
              三级标题 (H3)
            </button>
          </div>
        </div>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 3. 文字基础样式 (粗、斜、下划、删除、行内代码) -->
        <button
          type="button"
          @click="editor?.chain().focus().toggleBold().run()"
          :class="{ 'bg-sky-100 text-sky-700 font-bold': editor?.isActive('bold') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="粗体 (Ctrl+B)"
        >
          <Bold :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleItalic().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('italic') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="斜体 (Ctrl+I)"
        >
          <Italic :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleUnderline().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('underline') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="下划线 (Ctrl+U)"
        >
          <Underline :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleStrike().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('strike') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="删除线"
        >
          <Strikethrough :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleCode().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('code') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="行内代码"
        >
          <CodeIcon :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleSubscript().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('subscript') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="下标"
        >
          <SubscriptIcon :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleSuperscript().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('superscript') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="上标"
        >
          <SuperscriptIcon :size="15" />
        </button>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 4. 文字颜色选择面板 -->
        <div class="relative inline-block text-left">
          <button
            type="button"
            @click.stop="toggleTextColorMenu"
            class="flex items-center gap-0.5 p-1.5 rounded hover:bg-slate-100 transition group"
            title="文字颜色"
          >
            <div class="flex flex-col items-center">
              <span class="font-extrabold text-xs leading-none">A</span>
              <div class="w-3.5 h-1 rounded-full mt-0.5" :style="{ backgroundColor: currentTextColor || '#0f172a' }"></div>
            </div>
            <ChevronDown :size="10" class="text-slate-400 group-hover:text-slate-600" />
          </button>

          <!-- 文字颜色弹窗 -->
          <div
            v-if="showTextColorMenu"
            class="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50"
          >
            <div class="text-[11px] font-semibold text-slate-400 mb-2">常用文字颜色</div>
            <div class="grid grid-cols-5 gap-1.5 mb-2">
              <button
                v-for="c in textColors"
                :key="c.color"
                type="button"
                @click="setTextColor(c.color)"
                class="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center transition hover:scale-110"
                :style="{ backgroundColor: c.color }"
                :title="c.label"
              ></button>
            </div>
            <div class="border-t border-slate-100 pt-2 flex items-center justify-between">
              <label class="flex items-center gap-1.5 text-xs text-slate-600 hover:text-sky-600 cursor-pointer">
                <Palette :size="13" />
                <span>自定义</span>
                <input type="color" @change="onCustomTextColor" class="w-0 h-0 opacity-0" />
              </label>
              <button
                type="button"
                @click="setTextColor('')"
                class="text-xs text-slate-400 hover:text-slate-600"
              >
                默认
              </button>
            </div>
          </div>
        </div>

        <!-- 5. 荧光高亮背景色选择面板 -->
        <div class="relative inline-block text-left">
          <button
            type="button"
            @click.stop="toggleHighlightMenu"
            class="flex items-center gap-0.5 p-1.5 rounded hover:bg-slate-100 transition group"
            title="背景高亮色"
          >
            <div class="flex flex-col items-center">
              <Highlighter :size="14" />
              <div class="w-3.5 h-1 rounded-full mt-0.5" :style="{ backgroundColor: currentHighlightColor || '#fef08a' }"></div>
            </div>
            <ChevronDown :size="10" class="text-slate-400 group-hover:text-slate-600" />
          </button>

          <!-- 高亮颜色弹窗 -->
          <div
            v-if="showHighlightMenu"
            class="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50"
          >
            <div class="text-[11px] font-semibold text-slate-400 mb-2">荧光背景色</div>
            <div class="grid grid-cols-4 gap-2 mb-2">
              <button
                v-for="h in highlightColors"
                :key="h.color"
                type="button"
                @click="setHighlightColor(h.color)"
                class="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center transition hover:scale-110 shadow-sm"
                :style="{ backgroundColor: h.color }"
                :title="h.label"
              ></button>
            </div>
            <div class="border-t border-slate-100 pt-2 flex items-center justify-end">
              <button
                type="button"
                @click="setHighlightColor('')"
                class="text-xs text-slate-400 hover:text-slate-600"
              >
                清除高亮
              </button>
            </div>
          </div>
        </div>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 6. 对齐方式 -->
        <button
          type="button"
          @click="editor?.chain().focus().setTextAlign('left').run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive({ textAlign: 'left' }) }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="居左对齐"
        >
          <AlignLeft :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().setTextAlign('center').run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive({ textAlign: 'center' }) }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="居中对齐"
        >
          <AlignCenter :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().setTextAlign('right').run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive({ textAlign: 'right' }) }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="居右对齐"
        >
          <AlignRight :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().setTextAlign('justify').run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive({ textAlign: 'justify' }) }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="两端对齐"
        >
          <AlignJustify :size="15" />
        </button>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 7. 列表与待办 -->
        <button
          type="button"
          @click="editor?.chain().focus().toggleBulletList().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('bulletList') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="无序列表"
        >
          <List :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleOrderedList().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('orderedList') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="有序编号列表"
        >
          <ListOrdered :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleTaskList().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('taskList') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="交互待办复选列表"
        >
          <CheckSquare :size="15" />
        </button>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 8. 插入块 (引用、代码块、分割线、超链接、表格) -->
        <button
          type="button"
          @click="editor?.chain().focus().toggleBlockquote().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('blockquote') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="引用块"
        >
          <Quote :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().toggleCodeBlock().run()"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('codeBlock') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="多行代码块"
        >
          <Code :size="15" />
        </button>
        <button
          type="button"
          @click="editor?.chain().focus().setHorizontalRule().run()"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="分割线"
        >
          <Minus :size="15" />
        </button>
        <button
          type="button"
          @click="promptLink"
          :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('link') }"
          class="p-1.5 rounded hover:bg-slate-100 transition"
          title="插入/编辑超链接"
        >
          <LinkIcon :size="15" />
        </button>

        <!-- 表格精细操作下拉 -->
        <div class="relative inline-block text-left">
          <button
            type="button"
            @click.stop="toggleTableMenu"
            :class="{ 'bg-sky-100 text-sky-700': editor?.isActive('table') }"
            class="flex items-center gap-0.5 p-1.5 rounded hover:bg-slate-100 transition"
            title="表格操作"
          >
            <TableIcon :size="15" />
            <ChevronDown :size="10" />
          </button>
          <div
            v-if="showTableMenu"
            class="absolute left-0 mt-1 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs"
          >
            <button
              v-if="!editor?.isActive('table')"
              type="button"
              @click="insertDefaultTable"
              class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition font-medium text-sky-600"
            >
              插入 3×3 表格
            </button>
            <template v-else>
              <button
                type="button"
                @click="editor?.chain().focus().addRowAfter().run()"
                class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition"
              >
                在下方插入行
              </button>
              <button
                type="button"
                @click="editor?.chain().focus().deleteRow().run()"
                class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition text-rose-600"
              >
                删除当前行
              </button>
              <div class="h-[1px] bg-slate-100 my-1"></div>
              <button
                type="button"
                @click="editor?.chain().focus().addColumnAfter().run()"
                class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition"
              >
                在右侧插入列
              </button>
              <button
                type="button"
                @click="editor?.chain().focus().deleteColumn().run()"
                class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition text-rose-600"
              >
                删除当前列
              </button>
              <div class="h-[1px] bg-slate-100 my-1"></div>
              <button
                type="button"
                @click="editor?.chain().focus().deleteTable().run()"
                class="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition text-rose-600 font-semibold"
              >
                删除整个表格
              </button>
            </template>
          </div>
        </div>

        <button
          type="button"
          @click="editor?.chain().focus().unsetAllMarks().clearNodes().run()"
          class="p-1.5 rounded hover:bg-slate-100 transition text-slate-500 hover:text-rose-600"
          title="清除格式"
        >
          <RemoveFormatting :size="15" />
        </button>

        <div class="w-[1px] h-4 bg-slate-200 mx-1"></div>

        <!-- 9. 核心：万能附件胶囊插入 -->
        <label
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer font-medium transition"
          title="插入任意文件附件 (图片、音视频、PDF、压缩包、文档等)"
        >
          <Paperclip :size="14" />
          <span>添加附件</span>
          <input type="file" multiple class="hidden" @change="handleFileInput" />
        </label>
      </div>

      <!-- 右侧：同步状态 -->
      <div class="flex items-center gap-2 flex-shrink-0 text-xs">
        <span v-if="noteStore.saveStatus === 'saving'" class="text-amber-600 flex items-center gap-1">
          <Loader2 :size="12" class="animate-spin" /> 保存中...
        </span>
        <span v-else-if="noteStore.saveStatus === 'saved'" class="text-slate-400 flex items-center gap-1">
          <Check :size="12" class="text-emerald-500" /> 已保存至 NAS
        </span>
        <span v-else-if="noteStore.saveStatus === 'error'" class="text-rose-500">
          保存失败
        </span>
      </div>
    </div>

    <!-- 笔记正文可滚动主区域 -->
    <div class="flex-1 overflow-y-auto px-6 py-6 max-w-4xl w-full mx-auto">
      <!-- 笔记分类与快捷删除条 -->
      <div class="flex items-center justify-between mb-3">
        <div class="relative">
          <button
            type="button"
            @click.stop="toggleFolderMenu"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-medium transition"
            title="点击移动到其他分类"
          >
            <Folder :size="13" class="text-sky-500" />
            <span>分类: {{ currentFolderLabel }}</span>
            <ChevronDown :size="12" class="text-slate-400" />
          </button>

          <!-- 分类下拉选择菜单 -->
          <div
            v-if="showFolderMenu"
            @click.stop
            class="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
          >
            <div class="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase border-b border-slate-100">
              移动至分类文件夹
            </div>
            <button
              type="button"
              @click="changeFolder(null)"
              :class="!noteStore.activeNote?.folderId ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'"
              class="w-full text-left px-3 py-1.5 flex items-center gap-2 transition"
            >
              <FolderMinus :size="13" class="text-slate-400" />
              <span>未分类</span>
            </button>
            <button
              v-for="folder in noteStore.folders"
              :key="folder.id"
              type="button"
              @click="changeFolder(folder.id)"
              :class="noteStore.activeNote?.folderId === folder.id ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'"
              class="w-full text-left px-3 py-1.5 flex items-center gap-2 transition"
            >
              <Folder :size="13" class="text-sky-500" />
              <span class="truncate">{{ folder.name }}</span>
            </button>
          </div>
        </div>

        <!-- 移入废纸篓快捷按钮 -->
        <button
          v-if="!noteStore.activeNote?.isDeleted"
          type="button"
          @click="handleDeleteNote"
          class="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition"
          title="将此笔记移入废纸篓"
        >
          <Trash2 :size="13" />
          <span>删除笔记</span>
        </button>
      </div>

      <!-- 笔记标题输入框 -->
      <input
        v-model="activeTitle"
        @input="onTitleChange"
        type="text"
        placeholder="输入笔记标题..."
        class="w-full text-2xl md:text-3xl font-extrabold text-slate-900 border-none outline-none focus:ring-0 placeholder:text-slate-300 mb-4 bg-transparent"
      />

      <!-- Tiptap 编辑器渲染容器 -->
      <editor-content :editor="editor" class="focus:outline-none" />
    </div>

    <!-- 底部状态栏 -->
    <div class="flex-shrink-0 border-t border-slate-100 px-6 py-2 bg-slate-50/80 text-xs text-slate-400 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <span>字数：{{ characterCount }}</span>
        <span v-if="noteStore.activeNote?.updatedAt">
          修改于 {{ formatUpdateTime(noteStore.activeNote.updatedAt) }}
        </span>
      </div>
      <div>初晴笔记 · 数据存储于 NAS</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import UnderlineExtension from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CharacterCount from '@tiptap/extension-character-count';

import { 
  Undo, Redo, Bold, Italic, Underline, Strikethrough, Code as CodeIcon,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Highlighter, Palette, ChevronDown, ChevronLeft, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Quote, Code, Minus, Link as LinkIcon,
  Table as TableIcon, RemoveFormatting, Paperclip, UploadCloud, Check, Loader2,
  Folder, FolderMinus, Trash2
} from 'lucide-vue-next';

import { AttachmentExtension } from '../../extensions/AttachmentExtension';
import { useNoteStore } from '../../stores/noteStore';
import { ApiClient } from '../../api/client';

const emit = defineEmits<{
  (e: 'backToList'): void;
}>();

const noteStore = useNoteStore();
const activeTitle = ref('');
const isDragging = ref(false);

// 弹窗菜单状态
const showHeadingMenu = ref(false);
const showTextColorMenu = ref(false);
const showHighlightMenu = ref(false);
const showTableMenu = ref(false);

const textColors = [
  { label: '墨黑', color: '#0f172a' },
  { label: '板岩灰', color: '#64748b' },
  { label: '赤红', color: '#ef4444' },
  { label: '暖橙', color: '#f97316' },
  { label: '琥珀', color: '#f59e0b' },
  { label: '翠绿', color: '#10b981' },
  { label: '晴空蓝', color: '#0ea5e9' },
  { label: '靛蓝', color: '#2563eb' },
  { label: '魅紫', color: '#8b5cf6' },
  { label: '玫红', color: '#ec4899' },
];

const highlightColors = [
  { label: '明黄', color: '#fef08a' },
  { label: '薄荷绿', color: '#bbf7d0' },
  { label: '晴空浅蓝', color: '#bae6fd' },
  { label: '淡紫', color: '#e9d5ff' },
  { label: '柔粉', color: '#fbcfe8' },
  { label: '暖杏', color: '#fed7aa' },
  { label: '浅赤', color: '#fecaca' },
];

const editor = useEditor({
  content: noteStore.activeNote?.content || { type: 'doc', content: [] },
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({
      placeholder: '在这里开启你的记录，支持直接拖入任何文件...',
    }),
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Link.configure({
      openOnClick: false,
    }),
    Subscript,
    Superscript,
    UnderlineExtension,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    CharacterCount,
    AttachmentExtension,
  ],
  onUpdate: ({ editor }) => {
    if (noteStore.activeNote) {
      noteStore.activeNote.content = editor.getJSON();
      noteStore.queueSaveActiveNote();
    }
  },
});

const characterCount = computed(() => {
  return editor.value?.storage.characterCount?.characters() || 0;
});

const currentHeadingLabel = computed(() => {
  if (editor.value?.isActive('heading', { level: 1 })) return 'H1 大标题';
  if (editor.value?.isActive('heading', { level: 2 })) return 'H2 中标题';
  if (editor.value?.isActive('heading', { level: 3 })) return 'H3 小标题';
  return '正文';
});

const currentTextColor = computed(() => {
  return editor.value?.getAttributes('textStyle').color || '';
});

const currentHighlightColor = computed(() => {
  return editor.value?.getAttributes('highlight').color || '';
});

// 监听当前激活笔记切换，同步更新标题与内容
watch(
  () => noteStore.activeNote?.id,
  () => {
    if (noteStore.activeNote) {
      activeTitle.value = noteStore.activeNote.title || '';
      if (editor.value) {
        editor.value.commands.setContent(noteStore.activeNote.content || { type: 'doc', content: [] });
      }
    }
  },
  { immediate: true }
);

function onTitleChange() {
  if (noteStore.activeNote) {
    noteStore.activeNote.title = activeTitle.value;
    noteStore.queueSaveActiveNote();
  }
}

// 弹窗控制
const showFolderMenu = ref(false);

const currentFolderLabel = computed(() => {
  if (!noteStore.activeNote?.folderId) return '未分类';
  const f = noteStore.folders.find((x) => x.id === noteStore.activeNote?.folderId);
  return f ? f.name : '未分类';
});

function toggleFolderMenu() {
  showFolderMenu.value = !showFolderMenu.value;
  showHeadingMenu.value = false;
  showTextColorMenu.value = false;
  showHighlightMenu.value = false;
  showTableMenu.value = false;
}

async function changeFolder(folderId: string | null) {
  showFolderMenu.value = false;
  if (!noteStore.activeNote) return;
  await noteStore.moveNoteToFolder(noteStore.activeNote.id, folderId);
}

async function handleDeleteNote() {
  if (!noteStore.activeNote) return;
  if (confirm('确定要将当前笔记移入废纸篓吗？')) {
    await noteStore.deleteActiveNote();
    emit('backToList');
  }
}

function closePopovers() {
  showFolderMenu.value = false;
  showHeadingMenu.value = false;
  showTextColorMenu.value = false;
  showHighlightMenu.value = false;
  showTableMenu.value = false;
}

function toggleHeadingMenu() {
  showHeadingMenu.value = !showHeadingMenu.value;
  showTextColorMenu.value = false;
  showHighlightMenu.value = false;
  showTableMenu.value = false;
}

function toggleTextColorMenu() {
  showTextColorMenu.value = !showTextColorMenu.value;
  showHeadingMenu.value = false;
  showHighlightMenu.value = false;
  showTableMenu.value = false;
}

function toggleHighlightMenu() {
  showHighlightMenu.value = !showHighlightMenu.value;
  showHeadingMenu.value = false;
  showTextColorMenu.value = false;
  showTableMenu.value = false;
}

function toggleTableMenu() {
  showTableMenu.value = !showTableMenu.value;
  showHeadingMenu.value = false;
  showTextColorMenu.value = false;
  showHighlightMenu.value = false;
}

function setBlockType(type: 'p' | 'h1' | 'h2' | 'h3') {
  if (!editor.value) return;
  if (type === 'p') {
    editor.value.chain().focus().setParagraph().run();
  } else if (type === 'h1') {
    editor.value.chain().focus().toggleHeading({ level: 1 }).run();
  } else if (type === 'h2') {
    editor.value.chain().focus().toggleHeading({ level: 2 }).run();
  } else if (type === 'h3') {
    editor.value.chain().focus().toggleHeading({ level: 3 }).run();
  }
  showHeadingMenu.value = false;
}

function setTextColor(color: string) {
  if (!editor.value) return;
  if (!color) {
    editor.value.chain().focus().unsetColor().run();
  } else {
    editor.value.chain().focus().setColor(color).run();
  }
  showTextColorMenu.value = false;
}

function onCustomTextColor(e: Event) {
  const color = (e.target as HTMLInputElement).value;
  if (color) {
    setTextColor(color);
  }
}

function setHighlightColor(color: string) {
  if (!editor.value) return;
  if (!color) {
    editor.value.chain().focus().unsetHighlight().run();
  } else {
    editor.value.chain().focus().setHighlight({ color }).run();
  }
  showHighlightMenu.value = false;
}

function promptLink() {
  if (!editor.value) return;
  const previousUrl = editor.value.getAttributes('link').href;
  const url = window.prompt('请输入网页链接 (URL)：', previousUrl);

  if (url === null) return;
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function insertDefaultTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  showTableMenu.value = false;
}

// 处理点击选择附件上传
async function handleFileInput(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  for (let i = 0; i < target.files.length; i++) {
    await uploadAndInsertFile(target.files[i]);
  }
  target.value = '';
}

// 处理拖拽文件直接放入编辑器
async function handleDrop(e: DragEvent) {
  isDragging.value = false;
  if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
  for (let i = 0; i < e.dataTransfer.files.length; i++) {
    await uploadAndInsertFile(e.dataTransfer.files[i]);
  }
}

// 上传并生成卡片插入编辑器光标处
async function uploadAndInsertFile(file: File) {
  if (!editor.value || !noteStore.activeNote) return;
  try {
    const attachment = await ApiClient.uploadAttachment(file, noteStore.activeNote.id);
    editor.value.chain().focus().insertAttachment({
      id: attachment.id,
      originalName: attachment.originalName,
      size: attachment.size,
      category: attachment.category,
      mimeType: attachment.mimeType,
    }).run();
  } catch (err) {
    console.error('上传附件失败:', err);
    alert('上传附件失败，请检查网络或 NAS 服务');
  }
}

function formatUpdateTime(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>
