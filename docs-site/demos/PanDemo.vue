<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const target = ref<HTMLElement | null>(null);
const logs = ref<string[]>([]);
const panning = ref(false);
const offsetX = ref(0);
const offsetY = ref(0);
let cleanup: (() => void) | null = null;

onMounted(async () => {
  if (!target.value) return;
  const { pan } = await import('fngr/pan');
  cleanup = pan(target.value, {
    onPanstart(e) {
      panning.value = true;
      offsetX.value = e.deltaX;
      offsetY.value = e.deltaY;
      const entry = `panstart ${e.direction} — dx:${Math.round(e.deltaX)} dy:${Math.round(e.deltaY)}`;
      logs.value = [entry, ...logs.value.slice(0, 9)];
    },
    onPanmove(e) {
      offsetX.value = e.deltaX;
      offsetY.value = e.deltaY;
    },
    onPanend(e) {
      panning.value = false;
      offsetX.value = 0;
      offsetY.value = 0;
      const entry = `panend ${e.direction} — dx:${Math.round(e.deltaX)} dy:${Math.round(e.deltaY)}`;
      logs.value = [entry, ...logs.value.slice(0, 9)];
    },
    onPancancel() {
      panning.value = false;
      offsetX.value = 0;
      offsetY.value = 0;
    },
  });
});

onUnmounted(() => {
  cleanup?.();
});
</script>

<template>
  <div class="demo">
    <div class="demo-area">
      <div
        ref="target"
        class="demo-target"
        :class="{ dragging: panning }"
        :style="{ transform: `translate(${offsetX}px, ${offsetY}px)` }"
      >
        <span class="demo-label">Drag me</span>
      </div>
    </div>
    <div class="demo-log" aria-live="polite" aria-label="Pan event log">
      <div v-if="logs.length === 0" class="demo-log-empty">No events yet</div>
      <div v-for="(entry, i) in logs" :key="i" class="demo-log-entry">{{ entry }}</div>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: flex-start;
  margin: 1.5rem 0;
}

.demo-area {
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  position: relative;
  border-radius: 8px;
  border: 2px dashed #d5c4a1;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo-target {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  background-color: #ebdbb2;
  border: 2px solid #d5c4a1;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.demo-target:active {
  cursor: grabbing;
}

.demo-target.dragging {
  background-color: #d5c4a1;
  border-color: #83a598;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.demo-label {
  color: #665c54;
  font-size: 0.85rem;
  font-weight: 500;
  pointer-events: none;
}

.demo-log {
  flex: 1;
  min-height: 200px;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.82rem;
  line-height: 1.6;
  overflow-y: auto;
  background-color: #f9f5d7;
  color: #504945;
}

.demo-log-empty {
  color: #928374;
  font-style: italic;
}

.demo-log-entry {
  padding: 0.1rem 0;
}

.dark .demo-area {
  border-color: #504945;
}

.dark .demo-target {
  background-color: #3c3836;
  border-color: #504945;
}

.dark .demo-target:active {
  background-color: #504945;
}

.dark .demo-target.dragging {
  background-color: #504945;
  border-color: #83a598;
}

.dark .demo-label {
  color: #a89984;
}

.dark .demo-log {
  background-color: #1d2021;
  color: #bdae93;
}

.dark .demo-log-empty {
  color: #665c54;
}
</style>
