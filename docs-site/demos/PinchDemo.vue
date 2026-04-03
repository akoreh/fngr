<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const target = ref<HTMLElement | null>(null);
const logs = ref<string[]>([]);
const pinching = ref(false);
const currentScale = ref(1);
let cleanup: (() => void) | null = null;

onMounted(async () => {
  if (!target.value) return;
  const { pinch } = await import('fngr/pinch');
  cleanup = pinch(target.value, {
    onPinchstart(e) {
      pinching.value = true;
      currentScale.value = e.scale;
      const entry = `pinchstart — scale:${e.scale.toFixed(2)}`;
      logs.value = [entry, ...logs.value.slice(0, 9)];
    },
    onPinchmove(e) {
      currentScale.value = e.scale;
    },
    onPinchend(e) {
      pinching.value = false;
      const entry = `pinchend — scale:${e.scale.toFixed(2)}`;
      logs.value = [entry, ...logs.value.slice(0, 9)];
      currentScale.value = 1;
    },
    onPinchcancel() {
      pinching.value = false;
      currentScale.value = 1;
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
        :class="{ active: pinching }"
        :style="{ transform: `scale(${currentScale})` }"
      >
        <span class="demo-label">{{ currentScale.toFixed(2) }}x</span>
      </div>
      <div class="demo-hint">Pinch with two fingers on touch devices</div>
    </div>
    <div class="demo-log" aria-live="polite" aria-label="Pinch event log">
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
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.demo-target {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  user-select: none;
  touch-action: none;
  background-color: #ebdbb2;
  border: 2px solid #d5c4a1;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.demo-target.active {
  background-color: #d5c4a1;
  border-color: #83a598;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.demo-label {
  color: #665c54;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace;
  pointer-events: none;
}

.demo-hint {
  color: #928374;
  font-size: 0.75rem;
  font-style: italic;
  text-align: center;
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

.dark .demo-target {
  background-color: #3c3836;
  border-color: #504945;
}

.dark .demo-target.active {
  background-color: #504945;
  border-color: #83a598;
}

.dark .demo-label {
  color: #a89984;
}

.dark .demo-hint {
  color: #665c54;
}

.dark .demo-log {
  background-color: #1d2021;
  color: #bdae93;
}

.dark .demo-log-empty {
  color: #665c54;
}
</style>
