<template>
  <node-view-wrapper class="my-3 select-none">
    <!-- 图片类型展示 -->
    <div v-if="category === 'image'" class="group relative inline-block max-w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm transition hover:shadow-md">
      <img
        :src="viewUrl"
        :alt="originalName"
        class="max-h-[480px] w-auto max-w-full rounded-lg object-contain cursor-pointer"
        @click="openPreview"
        loading="lazy"
      />
      <!-- 悬浮控制工具栏 -->
      <div class="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 text-white text-xs">
        <span class="truncate max-w-[140px]">{{ originalName }}</span>
        <span class="text-slate-300">({{ formattedSize }})</span>
        <button type="button" @click.stop="downloadFile" class="hover:text-sky-300 p-1" title="下载">
          <Download :size="14" />
        </button>
        <button type="button" @click.stop="deleteNode" class="hover:text-red-400 p-1" title="删除">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- 音频类型展示 -->
    <div v-else-if="category === 'audio'" class="rounded-xl border border-sky-100 bg-sky-50/60 p-3 shadow-sm hover:border-sky-300 transition">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2.5 overflow-hidden">
          <div class="p-2 rounded-lg bg-sky-500 text-white flex-shrink-0">
            <Music :size="18" />
          </div>
          <div class="truncate">
            <div class="font-medium text-slate-800 text-sm truncate">{{ originalName }}</div>
            <div class="text-xs text-slate-500">{{ formattedSize }} · 音频文件</div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button type="button" @click="downloadFile" class="p-1.5 text-slate-500 hover:text-sky-600 rounded hover:bg-white" title="下载">
            <Download :size="16" />
          </button>
          <button type="button" @click="deleteNode" class="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-white" title="移除">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      <audio controls :src="viewUrl" class="w-full h-8" preload="metadata"></audio>
    </div>

    <!-- 视频类型展示 -->
    <div v-else-if="category === 'video'" class="rounded-xl border border-slate-200 bg-slate-900 p-2 shadow-sm">
      <div class="flex items-center justify-between text-white text-xs px-2 py-1 mb-1">
        <div class="flex items-center gap-2 truncate">
          <Video :size="14" class="text-sky-400" />
          <span class="truncate">{{ originalName }}</span>
          <span class="text-slate-400">({{ formattedSize }})</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button type="button" @click="downloadFile" class="hover:text-sky-300" title="下载"><Download :size="14" /></button>
          <button type="button" @click="deleteNode" class="hover:text-red-400" title="移除"><Trash2 :size="14" /></button>
        </div>
      </div>
      <video controls :src="viewUrl" class="max-h-[400px] w-full rounded-lg bg-black" preload="metadata"></video>
    </div>

    <!-- PDF / 各种文档 / 压缩包 / 任意通用附件卡片 -->
    <div v-else class="group flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm transition">
      <div class="flex items-center gap-3 overflow-hidden">
        <!-- 图标展示 -->
        <div :class="iconBadgeClass" class="p-2.5 rounded-xl flex-shrink-0 flex items-center justify-center">
          <component :is="categoryIcon" :size="20" />
        </div>
        <div class="truncate">
          <div class="font-medium text-slate-800 text-sm truncate flex items-center gap-2">
            <span>{{ originalName }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase bg-slate-100 text-slate-600">
              {{ extLabel }}
            </span>
          </div>
          <div class="text-xs text-slate-500 mt-0.5">
            {{ formattedSize }} · {{ categoryName }}
          </div>
        </div>
      </div>

      <!-- 操作按钮群 -->
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <!-- PDF 专用预览按钮 -->
        <button
          v-if="category === 'pdf'"
          type="button"
          @click="openPdfPreview"
          class="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition"
        >
          <Eye :size="14" />
          <span>预览</span>
        </button>

        <button
          type="button"
          @click="downloadFile"
          class="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          title="下载附件到本地"
        >
          <Download :size="14" />
          <span>下载</span>
        </button>

        <button
          type="button"
          @click="deleteNode"
          class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition"
          title="移除附件"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';
import { 
  FileText, FileArchive, FileCode, File, Music, Video, Image, Download, Trash2, Eye 
} from 'lucide-vue-next';
import { formatBytes, AttachmentCategory } from '@chuqing/shared';
import { useNoteStore } from '../../stores/noteStore';

const props = defineProps(nodeViewProps);
const noteStore = useNoteStore();

const id = computed(() => props.node.attrs.id);
const originalName = computed(() => props.node.attrs.originalName || '未命名附件');
const size = computed(() => props.node.attrs.size || 0);
const category = computed<AttachmentCategory>(() => props.node.attrs.category || 'other');
const mimeType = computed(() => props.node.attrs.mimeType || '');

const formattedSize = computed(() => formatBytes(size.value));
const viewUrl = computed(() => `/api/attachments/${id.value}/view`);
const downloadUrl = computed(() => `/api/attachments/${id.value}/download`);

const extLabel = computed(() => {
  const parts = originalName.value.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() : 'FILE';
});

const categoryName = computed(() => {
  switch (category.value) {
    case 'pdf': return 'PDF 文档';
    case 'document': return '办公文档';
    case 'archive': return '压缩文件';
    case 'code': return '源码/脚本';
    case 'audio': return '音频';
    case 'video': return '视频';
    default: return '文件附件';
  }
});

const categoryIcon = computed(() => {
  switch (category.value) {
    case 'pdf':
    case 'document': return FileText;
    case 'archive': return FileArchive;
    case 'code': return FileCode;
    case 'audio': return Music;
    case 'video': return Video;
    case 'image': return Image;
    default: return File;
  }
});

const iconBadgeClass = computed(() => {
  switch (category.value) {
    case 'pdf': return 'bg-rose-50 text-rose-600';
    case 'document': return 'bg-blue-50 text-blue-600';
    case 'archive': return 'bg-amber-50 text-amber-600';
    case 'code': return 'bg-emerald-50 text-emerald-600';
    default: return 'bg-slate-100 text-slate-600';
  }
});

function downloadFile() {
  const a = document.createElement('a');
  a.href = downloadUrl.value;
  a.download = originalName.value;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openPreview() {
  window.open(viewUrl.value, '_blank');
}

function openPdfPreview() {
  noteStore.previewPdfAttachment = {
    id: id.value,
    originalName: originalName.value,
    mimeType: mimeType.value,
    size: size.value,
    category: category.value,
    hash: '',
    storagePath: '',
    createdAt: '',
  };
}

function deleteNode() {
  props.deleteNode();
}
</script>
