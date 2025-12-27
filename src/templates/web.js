export function tplWebRuntime(ext) {
  if (ext === "js") {
    return `
export function createRuntime() {
  const hooks = [];
  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      const errors = [];
      for (const fn of toRun) {
        try {
          await fn();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) {
        console.warn("[SDD] resetEnv: hook errors", errors);
      }
    },
  };
}
`.trimStart();
  }

  return `
export type ResetHook = () => void | Promise<void>;

export type Runtime = {
  onReset(fn: ResetHook): void;
  resetEnv(): Promise<void>;
};

export function createRuntime(): Runtime {
  const hooks: ResetHook[] = [];

  return {
    onReset(fn) {
      hooks.push(fn);
    },
    async resetEnv() {
      const toRun = hooks.splice(0, hooks.length);
      const errors: unknown[] = [];
      for (const fn of toRun) {
        try {
          await fn();
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) {
        console.warn("[SDD] resetEnv: hook errors", errors);
      }
    },
  };
}
`.trimStart();
}

export function tplWebDiscoverVite(ext) {
  if (ext === "js") {
    return `
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
  const modules = import.meta.glob("../**/__sdd__/scenarios/**/*.scenario.{ts,js}", { eager: true });
  for (const mod of Object.values(modules)) {
    const scenario = mod?.default;
    if (isScenario(scenario)) out.push(scenario);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
  }

  return `
import type { Runtime } from "./runtime";

export type Scenario = {
  id: string;
  title: string;
  note?: string;
  setup(ctx: { runtime: Runtime; options?: any }): void | Promise<void>;
};

function isScenario(x: any): x is Scenario {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios(): Promise<Scenario[]> {
  const out: Scenario[] = [];
  const modules = import.meta.glob("../**/__sdd__/scenarios/**/*.scenario.{ts,js}", { eager: true });
  for (const mod of Object.values(modules) as any[]) {
    const scenario = mod?.default;
    if (isScenario(scenario)) out.push(scenario);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
}

export function tplWebDiscoverWebpack(ext) {
  if (ext === "js") {
    return `
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
  // [修复] 移除外层 if (typeof require !== "undefined") 判断
  // Webpack 会在编译时替换 require.context，运行时不需要 require 变量存在
  try {
    if (typeof require.context === "function") {
      const ctx = require.context("..", true, /__sdd__\\/scenarios\\/.*\\.scenario\\.(ts|js)$/);
      for (const key of ctx.keys()) {
        const mod = ctx(key);
        const scenario = mod?.default;
        if (isScenario(scenario)) out.push(scenario);
      }
    }
  } catch (e) {
    // 仅在非 Webpack 环境或宏未替换时会触发
    console.warn("[SDD] require.context failed or not available", e);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
  }

  // TypeScript 版本
  return `
import type { Runtime } from "./runtime";

export type Scenario = {
  id: string;
  title: string;
  note?: string;
  setup(ctx: { runtime: Runtime; options?: any }): void | Promise<void>;
};

declare const require: any;

function isScenario(x: any): x is Scenario {
  return (
    x &&
    typeof x === "object" &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.setup === "function"
  );
}

export async function discoverScenarios(): Promise<Scenario[]> {
  const out: Scenario[] = [];
  // [修复] 移除外层运行时检查，改用 try-catch
  try {
    // @ts-ignore
    if (typeof require?.context === "function") {
      const ctx = require.context("..", true, /__sdd__\\/scenarios\\/.*\\.scenario\\.(ts|js)$/);
      for (const key of ctx.keys()) {
        const mod = ctx(key);
        const scenario = mod?.default;
        if (isScenario(scenario)) out.push(scenario);
      }
    }
  } catch (e) {
    console.warn("[SDD] require.context failed or not available", e);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
`.trimStart();
}

export function tplWebBoot(ext) {
  if (ext === "js") {
    return `
import { createRuntime } from "./runtime";
import { discoverScenarios } from "./discover";

const runtime = createRuntime();

function ensureBooted() {
  const w = window;
  if (w.SDD?.__inited) return;

  w.SDD = {
    __inited: true,
    list: async () => {
      const scenarios = await discoverScenarios();
      return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
    },
    run: async (id, options) => {
      const scenarios = await discoverScenarios();
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) throw new Error(\`Scenario not found: \${id}\`);
      await runtime.resetEnv();
      await scenario.setup({ runtime, options });
    },
    runtime,
  };
}

ensureBooted();
`.trimStart();
  }

  return `
import { createRuntime } from "./runtime";
import { discoverScenarios } from "./discover";

declare global {
  interface Window {
    SDD?: any;
  }
}

const runtime = createRuntime();

function ensureBooted() {
  const w = window as any;
  if (w.SDD?.__inited) return;

  const api = {
    __inited: true,
    list: async () => {
      const scenarios = await discoverScenarios();
      return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
    },
    run: async (id: string, options?: any) => {
      const scenarios = await discoverScenarios();
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) throw new Error(\`Scenario not found: \${id}\`);

      await runtime.resetEnv();
      await scenario.setup({ runtime, options });
    },
    runtime,
  };

  w.SDD = api;
}

ensureBooted();
`.trimStart();
}

export function tplWebReadmeMd() {
  return `
# SDD-lite (Web)

## 用法（开发环境）

- 查看场景列表：\`window.SDD.list()\`
- 运行场景：\`window.SDD.run("<id>")\`

## 场景目录

- 全局只放基础设施：\`src/__sdd__/\`
- 所有 helpers/mocks/scenarios 必须放在模块内：\`<module>/__sdd__/\`
`.trimStart();
}

export function tplAgentGuideMd() {
  return `
# AGENT_GUIDE (SDD-lite)

必须遵守：

1. 全局极薄：只放扫描/boot/runtime，禁止把业务 helpers/mocks 放到 \`src/__sdd__/\`
2. 模块自治：helpers/mocks/scenarios 都必须在 \`<module>/__sdd__/\`
3. 场景结构固定：

\`\`\`ts
export default {
  id: string,
  title: string,
  note?: string,
  setup({ runtime, options }): void
}
\`\`\`

4. 清理机制优先级最高：任何副作用必须 \`runtime.onReset(fn)\` 登记；切场景会先 \`runtime.resetEnv()\`
5. 不追求断言/自动化：以“人工验证步骤 + 可观察输出”为主
6. 可复现输入：固定数据/固定 seed，避免随机
`.trimStart();
}
