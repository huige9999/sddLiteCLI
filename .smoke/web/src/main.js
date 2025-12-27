/* sdd-lite:boot:webpack */
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  try { require("./__sdd__/boot"); } catch {}
}

console.log('hello')
