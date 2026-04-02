<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const target = ref<HTMLElement | null>(null);
const logs = ref<string[]>([]);
let cleanup: (() => void) | null = null;

onMounted(async () => {
  if (!target.value) return;
  const { tap } = await import('fngr/tap');
  cleanup = tap(target.value, (e) => {
    const entry = `tap @ (${Math.round(e.pointers[0].clientX)}, ${Math.round(e.pointers[0].clientY)})`;
    logs.value = [entry, ...logs.value.slice(0, 9)];
  });
});

onUnmounted(() => {
  cleanup?.();
});
</script>

<template>
  <div class="tap-demo">
    <div ref="target" class="tap-target">
      <span class="tap-label">Tap here</span>
    </div>
    <div class="tap-log" aria-live="polite" aria-label="Tap event log">
      <div v-if="logs.length === 0" class="tap-log-empty">No events yet</div>
      <div v-for="(entry, i) in logs" :key="i" class="tap-log-entry">{{ entry }}</div>
    </div>
  </div>
</template>

<style scoped>
.tap-demo {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: flex-start;
  margin: 1.5rem 0;
}

.tap-target {
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  background-color: #ebdbb2;
  border: 2px solid #d5c4a1;
  transition: background-color 0.1s ease;
}

.tap-target:active {
  background-color: #d5c4a1;
}

.tap-label {
  color: #665c54;
  font-size: 0.95rem;
  font-weight: 500;
  pointer-events: none;
}

.tap-log {
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

.tap-log-empty {
  color: #928374;
  font-style: italic;
}

.tap-log-entry {
  padding: 0.1rem 0;
}

/* Dark mode */
.dark .tap-target {
  background-color: #3c3836;
  border-color: #504945;
}

.dark .tap-target:active {
  background-color: #504945;
}

.dark .tap-label {
  color: #a89984;
}

.dark .tap-log {
  background-color: #1d2021;
  color: #bdae93;
}

.dark .tap-log-empty {
  color: #665c54;
}
</style>
