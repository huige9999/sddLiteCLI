export function tplMpRuntime(ext) {
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
      for (const fn of toRun) await fn();
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
      for (const fn of toRun) {
        await fn();
      }
    },
  };
}
`.trimStart();
}

export function tplMpBoot(ext) {
  if (ext === "js") {
    return `
import { createRuntime } from "./runtime";
import { scenarios } from "./manifest";

const runtime = createRuntime();

export async function listScenarios() {
  return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
}

export async function runScenario(id, options) {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error(\`Scenario not found: \${id}\`);
  await runtime.resetEnv();
  await scenario.setup({ runtime, options });
}

export function getRuntime() {
  return runtime;
}

function attachGlobal() {
  const g = globalThis;
  if (g.SDD?.__inited) return;
  g.SDD = {
    __inited: true,
    list: listScenarios,
    run: runScenario,
    runtime,
  };
}

attachGlobal();
`.trimStart();
  }

  return `
import { createRuntime } from "./runtime";
import { scenarios } from "./manifest";

const runtime = createRuntime();

export async function listScenarios() {
  return scenarios.map((s) => ({ id: s.id, title: s.title, note: s.note }));
}

export async function runScenario(id: string, options?: any) {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error(\`Scenario not found: \${id}\`);

  await runtime.resetEnv();
  await scenario.setup({ runtime, options });
}

export function getRuntime() {
  return runtime;
}

function attachGlobal() {
  const g: any = globalThis as any;
  if (g.SDD?.__inited) return;
  g.SDD = {
    __inited: true,
    list: listScenarios,
    run: runScenario,
    runtime,
  };
}

attachGlobal();
`.trimStart();
}

export function tplMpReadmeMd() {
  return `
# SDD-lite（小程序）

推荐用调试页运行场景：\`pages/__sdd__/index\`

- 列表：页面自动渲染 manifest 中的场景
- 运行：点击运行前会先 resetEnv，确保不污染
`.trimStart();
}

export function tplMpAgentGuideMd() {
  return `
# AGENT_GUIDE (SDD-lite / 小程序)

规则同 Web：

1. 全局极薄：只放 runtime/boot/manifest
2. 模块自治：helpers/mocks/scenarios 必须在模块内
3. 场景结构固定 + onReset 清理优先
`.trimStart();
}

export function tplMpDebugPage(ext) {
  if (ext === "js") {
    return `
import { listScenarios, runScenario } from "../../__sdd__/boot";

Page({
  data: {
    scenarios: [],
    runningId: "",
    note: "",
    error: "",
  },
  async onLoad() {
    const scenarios = await listScenarios();
    this.setData({ scenarios });
  },
  async onRunTap(e) {
    const id = e?.currentTarget?.dataset?.id;
    if (!id) return;

    this.setData({ runningId: id, error: "", note: "" });
    try {
      await runScenario(id);
      const list = await listScenarios();
      const s = list.find((x) => x.id === id);
      this.setData({ note: s?.note || "" });
    } catch (err) {
      this.setData({ error: String(err?.message || err) });
    }
  },
});
`.trimStart();
  }

  return `
import { listScenarios, runScenario } from "../../__sdd__/boot";

Page({
  data: {
    scenarios: [] as any[],
    runningId: "",
    note: "",
    error: "",
  },
  async onLoad() {
    const scenarios = await listScenarios();
    this.setData({ scenarios });
  },
  async onRunTap(e: any) {
    const id = e?.currentTarget?.dataset?.id;
    if (!id) return;

    this.setData({ runningId: id, error: "", note: "" });
    try {
      await runScenario(id);
      const list = await listScenarios();
      const s = list.find((x) => x.id === id);
      this.setData({ note: s?.note || "" });
    } catch (err: any) {
      this.setData({ error: String(err?.message || err) });
    }
  },
});
`.trimStart();
}

export function tplMpDebugPageWxml() {
  return `
<view class="page">
  <view class="title">SDD-lite</view>

  <view wx:if="{{error}}" class="error">{{error}}</view>
  <view wx:if="{{note}}" class="note">{{note}}</view>

  <view class="list">
    <view wx:for="{{scenarios}}" wx:key="id" class="item">
      <view class="meta">
        <view class="id">{{item.id}}</view>
        <view class="t">{{item.title}}</view>
      </view>
      <button data-id="{{item.id}}" bindtap="onRunTap" size="mini">运行</button>
    </view>
  </view>
</view>
`.trimStart();
}

export function tplMpDebugPageWxss() {
  return `
.page { padding: 16px; }
.title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
.error { color: #b91c1c; margin-bottom: 12px; white-space: pre-wrap; }
.note { color: #374151; margin-bottom: 12px; white-space: pre-wrap; }
.item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
.id { font-family: monospace; color: #111827; }
.t { color: #6b7280; font-size: 12px; }
`.trimStart();
}

export function tplMpDebugPageJson() {
  return JSON.stringify({ navigationBarTitleText: "SDD-lite" }, null, 2) + "\n";
}
