export function tplModuleSddTools(ext) {
  if (ext === "js") {
    return `
export function logScope(scope) {
  return (...args) => console.log(\`[SDD:\${scope}]\`, ...args);
}
`.trimStart();
  }

  return `
export function logScope(scope: string) {
  return (...args: any[]) => console.log(\`[SDD:\${scope}]\`, ...args);
}
`.trimStart();
}

export function tplModuleMocksIndex(ext) {
  if (ext === "js") {
    return `
export const mocks = {};
`.trimStart();
  }

  return `
export const mocks = {};
`.trimStart();
}

export function tplModuleScenariosReadmeMd() {
  return `
# SDD Scenarios (module)

每个场景文件必须：

\`\`\`ts
export default {
  id: string,
  title: string,
  note?: string,
  setup({ runtime, options }): void
}
\`\`\`

注意：任何副作用都必须通过 \`runtime.onReset\` 登记清理，保证切换场景不污染环境。
`.trimStart();
}

export function tplScenarioBasic({ id, title, ext }) {
  const setupSig = ext === "js" ? "setup({ runtime, options })" : "setup({ runtime, options }: any)";
  return `
export default {
  id: ${JSON.stringify(id)},
  title: ${JSON.stringify(title)},
  note: [
    "人工验证：",
    "1) 打开目标页面/模块",
    "2) 运行 window.SDD.run(\\"${id}\\")",
    "3) 观察 console log / UI 变化是否符合预期",
  ].join("\\n"),
  ${setupSig} {
    console.log("[SDD] setup", ${JSON.stringify(id)}, { options });

    const timer = setInterval(() => {
      console.log("[SDD] tick", ${JSON.stringify(id)});
    }, 1000);

    runtime.onReset(() => {
      clearInterval(timer);
    });
  },
};
`.trimStart();
}

export function tplScenarioApiVariants({ id, title, ext }) {
  const setupSig = ext === "js" ? "setup({ runtime, options })" : "setup({ runtime, options }: any)";
  return `
import { installApiPatch } from "../helpers/apiPatch";

export default {
  id: ${JSON.stringify(id)},
  title: ${JSON.stringify(title)},
  note: [
    "人工验证：",
    "1) 运行该场景后，触发页面里的接口请求动作",
    "2) 在 console/Network 面板观察不同 variant 的效果",
    "3) 切换场景后，拦截必须被清理（不污染其他场景）",
  ].join("\\n"),
  ${setupSig} {
    const uninstall = installApiPatch({
      runtime,
      variant: options?.variant ?? "happy-path",
    });
    runtime.onReset(uninstall);
  },
};
`.trimStart();
}

export function tplHelperApiPatch(ext) {
  const sig = ext === "js" ? "export function installApiPatch({ runtime, variant })" : "export function installApiPatch({ runtime, variant }: any)";
  return `
${sig} {
  void runtime;
  console.log("[SDD] installApiPatch", { variant });

  // TODO: 在这里做你项目里的 API 拦截/patch（不要绑定 axios/fetch，保持轻量）
  // TODO: 必须返回可逆的 uninstall（并在 reset 时调用）

  return () => {
    console.log("[SDD] uninstallApiPatch", { variant });
  };
}
`.trimStart();
}
