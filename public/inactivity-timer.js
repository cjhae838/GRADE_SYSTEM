// ===== Inactivity Timer Module =====
// Reusable 15-minute inactivity timer
// Only tracks clicks and scroll events
// Continues running even when tab is hidden

export function startInactivityTimer({ 
  timeoutMs = 15 * 60 * 1000,  // 15 minutes exactly
  onTimeout,
  events = ['click', 'scroll']  // Only clicks and scroll
}) {
  let timerId = null;
  let destroyed = false;

  function reset() {
    if (destroyed) return;
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      if (!destroyed && onTimeout) onTimeout();
    }, timeoutMs);
  }

  function onActivity(e) {
    // Ignore events on modal overlays (but allow on modal cards)
    if (e.target.closest('.modal-overlay') && !e.target.closest('.modal-card')) return;
    reset();
  }

  const eventList = events;
  eventList.forEach(evt => document.addEventListener(evt, onActivity, { passive: true }));
  reset();

  return {
    reset,
    stop: () => clearTimeout(timerId),
    destroy: () => {
      destroyed = true;
      clearTimeout(timerId);
      eventList.forEach(evt => document.removeEventListener(evt, onActivity));
    }
  };
}