<template>
  <div :style="{ width: `${size}px`, height: `${size}px` }" class="inline-flex items-center justify-center flex-shrink-0 select-none">
    <svg viewBox="0 0 100 100" class="w-full h-full drop-shadow">
      <defs>
        <!-- 笔记本封面渐变 -->
        <linearGradient :id="'nbCover-' + id" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="60%" stop-color="#0369a1"/>
          <stop offset="100%" stop-color="#075985"/>
        </linearGradient>

        <!-- 书脊暗色渐变 -->
        <linearGradient :id="'nbSpine-' + id" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#075985"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>

        <!-- 纸张厚度渐变 -->
        <linearGradient :id="'nbPages-' + id" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>

        <!-- 书签丝带金橙渐变 -->
        <linearGradient :id="'nbRibbon-' + id" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>

      <!-- 1. 底层露出的纸张层 (营造立体厚本子感) -->
      <rect x="22" y="14" width="64" height="76" rx="5" :fill="'url(#nbPages-' + id + ')'" />
      <line x1="84" y1="18" x2="84" y2="86" stroke="#cbd5e1" stroke-width="0.8" />
      <line x1="25" y1="88" x2="83" y2="88" stroke="#cbd5e1" stroke-width="0.8" />

      <!-- 2. 笔记本正封面 -->
      <rect x="16" y="11" width="67" height="78" rx="5" :fill="'url(#nbCover-' + id + ')'" />

      <!-- 3. 左侧书脊压槽与缝线 -->
      <path d="M 16 16 A 5 5 0 0 1 21 11 L 26 11 L 26 89 L 21 89 A 5 5 0 0 1 16 84 Z" :fill="'url(#nbSpine-' + id + ')'" />
      <line x1="26" y1="11" x2="26" y2="89" stroke="#082f49" stroke-width="0.8" opacity="0.6"/>
      <line x1="27" y1="11" x2="27" y2="89" stroke="#38bdf8" stroke-width="0.5" opacity="0.4"/>
      <!-- 书脊缝线 -->
      <line x1="21" y1="16" x2="21" y2="84" stroke="#7dd3fc" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.5"/>

      <!-- 4. 封面排版横线 (极简记录横条) -->
      <line x1="34" y1="36" x2="56" y2="36" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
      <line x1="34" y1="43" x2="65" y2="43" stroke="#7dd3fc" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>
      <line x1="34" y1="50" x2="48" y2="50" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round" opacity="0.4"/>

      <!-- 5. 经典右侧皮筋带 (MOMENT/MOLESKINE 风格) -->
      <rect x="71" y="10" width="5" height="80" rx="1" fill="#0369a1" opacity="0.85" />
      <rect x="71" y="10.5" width="5" height="1.5" fill="#94a3b8" />
      <rect x="71" y="88" width="5" height="1.5" fill="#94a3b8" />

      <!-- 6. 丝带书签 (垂下在封面外) -->
      <path d="M 46 10 L 53 10 L 53 34 L 49.5 30 L 46 34 Z" :fill="'url(#nbRibbon-' + id + ')'" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    size?: number;
    variant?: 'symbol' | 'app';
  }>(),
  {
    size: 32,
    variant: 'app',
  }
);

const id = computed(() => Math.random().toString(36).substring(2, 8));
</script>
