export function createRuntime() {
  const hooks = [];
  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      for (const fn of toRun) await fn();
    },
  };
}
