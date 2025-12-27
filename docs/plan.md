好，那我给你一份**Node + TS CLI 的实现方案**（不是代码），覆盖你当前要支持的：**Vue2、Vue3、原生微信小程序**，并且把未来扩展 React/Uniapp 的路给你留好。你把这份方案丢给本地 agent，就能让它按你的风格把脚手架做出来。

---

## 1. 总体架构：Core 不变 + Adapter 可插拔

把 CLI 分成两层：

### Core（通用，不随项目类型变化）

* 文件写入/幂等更新（不会乱覆盖）
* 模板渲染（字符串替换即可）
* 命令与参数解析（init/add-module/add-scenario/doctor）
* 场景扫描与 doctor 规则框架（按 adapter 提供规则）

### Adapter（随项目类型变化）

每种项目类型（vue2/vue3/mp-wechat）实现同一套接口：

* `detect(projectRoot) -> confidence + hints`
* `init(plan) -> filesToCreate + entryPatchPlan + postNotes`
* `doctor(projectRoot) -> checks[]`
* （可选）`scenarioIndexing`：Web 用 discover；小程序用 manifest

**核心点**：新增 React/Uniapp 只是加一个 adapter，不动 core。

---

## 2. CLI 设计（命令与参数）

你先只做这四个命令，未来 MCP 化也容易：

1. `sdd-lite init`

* 交互选择项目类型：`vue2 | vue3 | mp-wechat`
* 可选参数：`--type vue2|vue3|mp-wechat`
* 可选参数：`--entry <file>`（用户指定入口文件）
* 输出：生成/修改了哪些文件 + 如果没能自动注入入口，给出手工 patch 片段

2. `sdd-lite add-module <modulePath>`

* 生成 `<modulePath>/__sdd__/helpers|mocks|scenarios`
* 幂等：存在则补齐缺失，不破坏用户已有文件

3. `sdd-lite add-scenario <modulePath>`

* 交互选择模板：例如 `basic / api-variants / leaderboard10`（第一版只需要 basic + api-variants 就够）
* 参数：

  * `--id` `--title` `--template` `--ts/--js`
* 若模块还没 `__sdd__`，自动先跑 `add-module`

4. `sdd-lite doctor`

* 输出 ✅/⚠️/❌ + 修复建议
* 支持 `--json`（为未来工具化预留）

---

## 3. 目录与产出物（你脚手架落地后仓库会长这样）

### Web（Vue2/Vue3）全局

```
src/__sdd__/
  boot.ts
  runtime.ts
  discover.ts          # 统一适配 vite/webpack（建议一个文件兼容两者）
  README.md
  AGENT_GUIDE.md
```

### 模块自治

```
<module>/__sdd__/
  helpers/
    sddTools.ts
    apiPatch.ts         # 可选（当选择 api-variants 模板时生成）
  mocks/
    index.ts
  scenarios/
    <id>.scenario.ts
    README.md
```

### 原生微信小程序全局（建议放 miniprogram 或项目根，按你的仓库结构）

```
miniprogram/__sdd__/
  runtime.ts
  boot.ts
  manifest.ts          # CLI 生成的场景清单（静态 import）
  README.md
  AGENT_GUIDE.md
```

并建议生成一个调试页（体验会好很多）：

```
miniprogram/pages/__sdd__/index.(ts|js)
miniprogram/pages/__sdd__/index.(wxml|wxss|json)
```

> 小程序没有 `window`，也不适合“控制台 list/run”，所以调试页是最稳的交互入口。

---

## 4. Web 端的关键实现点（Vue2/Vue3）

### 4.1 discover.ts：一份文件兼容 vite/webpack

* 运行时判断 `import.meta.glob` 是否存在（Vite）
* 否则判断 `require.context`（Webpack）
* 统一产出 `Scenario[]`

### 4.2 boot.ts：幂等挂载 window.SDD

* `window.SDD.__inited` 防重复
* `SDD.list()` 返回 `{id,title,note}` 列表
* `SDD.run(id, options?)`：

  * `runtime.resetEnv()`
  * 调 `scenario.setup({ runtime, options })`

> 注意：你现在 run 里只传 runtime，建议 CLI 第一版就支持 options，后面你会很爽。

### 4.3 入口注入策略（init 的重头戏）

你要做到“能自动则自动，不能自动就提示手工改”。

* Vue2 常见入口：`src/main.js|ts`
* Vue3 常见入口：`src/main.ts|js`

注入片段（dev-only）：

* Vite 项目：`if (import.meta.env.DEV) import('./__sdd__/boot')`
* 非 Vite（或不确定）：`if (process.env.NODE_ENV !== 'production') require('./__sdd__/boot')`

**自动注入的安全原则**：

* 只在你能确定入口文件存在时才 patch
* patch 方式：找文件顶部第一个 import 后插入，或直接文件头插入
* 若已存在相同片段，跳过（幂等）
* patch 失败就输出“手工插入建议”，doctor 会检查它是否存在

---

## 5. 原生微信小程序的关键实现点（和 Web 完全不同）

### 5.1 为什么要 manifest

小程序环境不适合动态扫描与动态 import，最稳的是：

* CLI 扫描全项目的 `**/__sdd__/scenarios/**/*.scenario.ts`
* 生成一个 `miniprogram/__sdd__/manifest.ts`，里面是静态 import + 列表导出
* boot 读 manifest，暴露一个全局 API（放 `globalThis` 或 `getApp()` 上）

### 5.2 小程序“如何 run 场景”

建议做一个 dev-only 页面：`pages/__sdd__/index`

* 页面加载：读取 manifest，渲染场景列表
* 点击运行：`runtime.resetEnv()` → `scenario.setup({ runtime, options })`
* note 展示在页面上，方便人照着做

### 5.3 小程序 init 要 patch 哪些东西

* 确认小程序根目录（常见：`miniprogram/` 或根目录）
* 生成 `miniprogram/__sdd__/runtime/boot/manifest/README/AGENT_GUIDE`
* 把调试页加入 `app.json` 的 pages（或提示手工添加，doctor 检查）
* 如果是 TypeScript 小程序，注意路径与编译产物（你的 CLI 只生成源码就行）

---

## 6. doctor 的范围（第一版就能很有用）

### Web doctor 检查项

* `src/__sdd__/boot.ts` 是否存在
* 入口文件是否包含注入片段（或至少 import boot 的语句）
* 扫描场景文件，检查：

  * default export 是否存在（第一版可用简单规则：必须含 `id:` / `setup(`）
  * `id` 是否重复
* boot 是否幂等：检查是否含 `__inited`（静态提示）

### 小程序 doctor 检查项

* `miniprogram/__sdd__/manifest.ts` 是否存在
* 是否存在调试页文件
* `app.json` 是否包含调试页路径（或提示手工加入）
* manifest 中 import 的场景路径是否都存在

输出格式：

* 人类：✅/⚠️/❌ + 具体修复建议（带文件路径）
* 可选：`--json` 输出结构化 checks（未来扩展时更稳）

---

## 7. 模板策略：少模板，多“固定骨架 + TODO 位”

你现在要支持三类项目，但你不想模板爆炸。建议：

* 全局模板：Web 一套，小程序一套
* 模块模板：通用一套
* 场景模板：2 个就够（第一版）

  * `basic`：只提供固定结构 + note + 示例 onReset
  * `api-variants`：额外生成 `helpers/apiPatch.ts` 骨架（不绑定 axios/fetch，留 TODO）

不要做“Vue2 一套、Vue3 一套场景模板”，场景结构你已经统一了，差异只出现在“驱动入口”——那部分让 agent/开发者在 TODO 里补。

---

## 8. 幂等与“不破坏用户文件”的策略（脚手架能活下去的关键）

你的 CLI 一定要遵循三条：

1. **默认不覆盖已有文件**

   * 已存在就跳过，或写 `.example` 文件供参考
2. **只做最小可识别 patch**

   * 入口注入用“存在即跳过”的片段检测
3. **所有写入都有变更报告**

   * 输出：新增/修改/跳过 的文件清单

这会让你敢在任何项目里反复执行，不怕把人家代码炸了。

---

## 9. 给 agent 的背景 md：作为 init 必产出

你已经决定这点，我建议固定生成两份：

* `src/__sdd__/AGENT_GUIDE.md`（规范硬约束）
* `src/__sdd__/README.md`（人类使用方式）

小程序同理放到 `miniprogram/__sdd__/`。

---

## 实现顺序
按这个顺序做最稳：

1. 先搭 CLI 框架（commander + prompts）
2. 实现 `init`（先只生成文件，不做入口 patch）
3. 再实现 `doctor`（能检查 init 是否成功）
4. 再实现 `add-module`
5. 再实现 `add-scenario`
6. 最后补入口自动 patch 与小程序调试页注册

这样每一步都有可验证输出，不会陷入“写到一半跑不起来”。
