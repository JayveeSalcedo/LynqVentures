// Route migrated lessons back to the React host when opened from a legacy dashboard.
// Standalone legacy documents keep their original behavior.
(() => {
  if (window.parent === window || typeof window.openLesson !== 'function') return;
  const legacyOpenLesson = window.openLesson;
  window.openLesson = function (number) {
    if (number === 1) {
      window.parent.postMessage({ type: 'academyLesson', lesson: 1 }, window.location.origin);
      return;
    }
    return legacyOpenLesson(number);
  };
})();
