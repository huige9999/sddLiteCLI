export function logScope(scope) {
  return (...args) => console.log(`[SDD:${scope}]`, ...args);
}
