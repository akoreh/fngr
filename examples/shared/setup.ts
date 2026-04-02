export interface GestureResult {
  type: string;
  timestamp: number;
  detail: Record<string, unknown>;
}

declare global {
  interface Window {
    fngrResults: GestureResult[];
    fngrClear: () => void;
  }
}

window.fngrResults = [];

window.fngrClear = () => {
  window.fngrResults = [];
};

const log = document.getElementById('log')!;

export function logEvent(name: string, detail?: Record<string, unknown>) {
  // Expose to window for Playwright
  window.fngrResults.push({
    type: name,
    timestamp: performance.now(),
    detail: detail ?? {},
  });

  // Visual log
  const entry = document.createElement('div');
  entry.className = 'entry';
  entry.textContent = detail
    ? `${name}: ${JSON.stringify(detail)}`
    : name;
  log.prepend(entry);
}
