<template>
  <div
    v-if="noteStore.previewPdfAttachment"
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    @click.self="close"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div class="flex items-center gap-2.5 truncate">
          <div class="p-1.5 rounded-lg bg-rose-50 text-rose-600">
            <FileText :size="18" />
          </div>
          <span class="font-bold text-sm text-slate-800 truncate">
            {{ noteStore.previewPdfAttachment.originalName }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <a
            :href="`/api/attachments/${noteStore.previewPdfAttachment.id}/download`"
            download
            class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition"
          >
            下载原文件
          </a>
          <button
            type="button"
            @click="close"
            class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- PDF Preview Iframe -->
      <div class="flex-1 bg-slate-100">
        <iframe
          :src="`/api/attachments/${noteStore.previewPdfAttachment.id}/view`"
          class="w-full h-full border-none"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileText, X } from 'lucide-vue-next';
import { useNoteStore } from '../../stores/noteStore';

const noteStore = useNoteStore();

function close() {
  noteStore.previewPdfAttachment = null;
}
</script>
