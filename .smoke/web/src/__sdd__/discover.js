function isScenario(x) {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios() {
  const out = [];

  const glob = import.meta && import.meta.glob;
  if (typeof glob === "function") {
    const modules = glob("../**/__sdd__/scenarios/**/*.scenario.{ts,js}", { eager: true });
    for (const mod of Object.values(modules)) {
      const scenario = mod?.default;
      if (isScenario(scenario)) out.push(scenario);
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  if (typeof require !== "undefined" && typeof require.context === "function") {
    const ctx = require.context("..", true, /__sdd__\/scenarios\/.*\.scenario\.(ts|js)$/);
    for (const key of ctx.keys()) {
      const mod = ctx(key);
      const scenario = mod?.default;
      if (isScenario(scenario)) out.push(scenario);
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  return out;
}
