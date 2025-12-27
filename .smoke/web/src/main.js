/* sdd-lite:boot */
(() => {
  try {
    // Vite
    if ((import.meta).env?.DEV) { void import("./__sdd__/boot"); return; }
  } catch {}
  // Webpack/others
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    try { require("./__sdd__/boot"); } catch {}
  }
})();

console.log('hello')
