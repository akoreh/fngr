<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const target = ref<HTMLElement | null>(null);
const logs = ref<string[]>([]);
const lastDirection = ref('');
let cleanup: (() => void) | null = null;

onMounted(async () => {
  if (!target.value) return;
  const { swipe } = await import('fngr/swipe');
  cleanup = swipe(target.value, {
    onSwipe(e) {
      lastDirection.value = e.direction;
      const entry = `swipe ${e.direction} — ${Math.round(e.distance)}px @ ${e.velocity.toFixed(2)} px/ms`;
      logs.value = [entry, ...logs.value.slice(0, 9)];
      setTimeout(() => {
        lastDirection.value = '';
      }, 300);
    },
  });
});

onUnmounted(() => {
  cleanup?.();
});

const arrows: Record<string, string> = {
  left: '\u2190',
  right: '\u2192',
  up: '\u2191',
  down: '\u2193',
};
</script>

<template>
  <div class="demo">
    <div ref="target" class="demo-target" :class="{ swiped: lastDirection }">
      <span v-if="lastDirection" class="demo-arrow">{{ arrows[lastDirection] }}</span>
      <span v-else class="demo-label">Swipe here</span>
    </div>
    <div class="demo-log" aria-live="polite" aria-label="Swipe event log">
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

.demo-target {
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  background-color: #ebdbb2;
  border: 2px solid #d5c4a1;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.demo-target:active {
  cursor: grabbing;
}

.demo-target.swiped {
  background-color: #d5c4a1;
  border-color: #83a598;
}

.demo-label {
  color: #665c54;
  font-size: 0.95rem;
  font-weight: 500;
  pointer-events: none;
}

.demo-arrow {
  font-size: 2.5rem;
  color: #665c54;
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

.dark .demo-target {
  background-color: #3c3836;
  border-color: #504945;
}

.dark .demo-target:active {
  background-color: #504945;
}

.dark .demo-target.swiped {
  background-color: #504945;
  border-color: #83a598;
}

.dark .demo-label {
  color: #a89984;
}

.dark .demo-arrow {
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
