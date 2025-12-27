# SDD-lite CLI 开发背景说明

## 1. 项目背景与动机

我在多个项目中做开发，节奏快、需求变动频繁，不适合投入 Jest/BDD 那种重测试体系。
我要落地一套 **SDD-lite（场景驱动开发-lite）**：测试对象主要是“人”，通过 **“场景一键开启 + 人工点点点/控制台操作 + 可复现输入”** 获得信心，而不是追求自动化断言或 CI。

SDD-lite 的核心价值是：把“偶发/难复现”的问题变成“可复现输入 + 可观察趋势”，并保证切换场景不会污染环境（清理机制是关键）。

---

## 2. SDD-lite 核心原则（必须遵守）

1. **全局极薄**
   全局只放基础设施：扫描场景、挂载 `list/run`、统一 `resetEnv`。
   全局目录固定为：`src/__sdd__/`（Web 项目），或 `miniprogram/__sdd__/`（原生微信小程序）。
   **禁止**把模块的 helpers/mocks 放进全局（避免全局变杂物堆）。

2. **模块自治**
   所有辅助方法必须在模块内：

* `<module>/__sdd__/helpers/*`（驱动/观测/patch/api拦截等）
* `<module>/__sdd__/mocks/*`（固定可复现数据）
* `<module>/__sdd__/scenarios/**/*.scenario.(js|ts)`（场景文件）

3. **场景文件结构固定**
   每个场景必须：

```ts
export default {
  id: string,
  title: string,
  note?: string,
  setup({ runtime, options }): void
}
```

4. **清理机制优先级最高**
   任何副作用（interval/timeout/事件监听/订阅/拦截器/patch）必须：

* 通过 `runtime.onReset(fn)` 登记清理
* 切场景前 `runtime.resetEnv()` 会执行所有 reset hooks
* patch 必须可逆（unpatch）

5. **不追求断言/自动化**
   允许写 console log、DOM计数、趋势观察；结果写在 `note` 里指导人工验证。

6. **可复现输入**
   场景必须使用固定数据或固定 seed；避免“随机一把看运气”。

---

## 3. 我当前的目标：做一个本地 Node + TS CLI（不需要发布）

我需要一个 CLI 脚手架，让我在不同项目里快速落地 SDD-lite。
**不需要发布到 npm**，可以作为本地工具仓库使用。
CLI 只需要产出文件、最小 patch、以及 doctor 自检；场景里的业务驱动由人工/agent补齐。

---

## 4. 首期支持范围（必须支持）

### Web 项目

* **Vue2**
* **Vue3**
  （构建工具可能是 Vite 或 Webpack；优先做兼容 discover）

### 原生微信小程序

* 由于没有 window、动态扫描不可靠，建议生成 `manifest` + 调试页（页面列出场景、一键运行）

### 未来扩展（暂不实现，但设计要能扩）

* React
* Uniapp

---

## 5. CLI 需要实现的命令（第一版）

### 5.1 `sdd-lite init`

**Web：**

* 生成 `src/__sdd__/` 目录与文件：

  * `runtime.ts`（onReset/resetEnv）
  * `discover.ts`（vite glob + webpack require.context 兼容）
  * `boot.ts`（挂载 window.SDD.list/run，且幂等）
  * `README.md`（给人类的使用说明）
  * `AGENT_GUIDE.md`（给 agent 的写场景规范）
* 入口注入策略：

  * 尽量自动在入口文件插入 dev-only import（幂等）
  * 如果无法确定入口，输出“手工插入片段”，并由 doctor 检查

**小程序：**

* 生成 `miniprogram/__sdd__/`：

  * `runtime.ts`
  * `boot.ts`
  * `manifest.ts`（由 CLI 生成：静态 import 场景并导出数组）
  * `README.md`
  * `AGENT_GUIDE.md`
* 建议生成调试页：`miniprogram/pages/__sdd__/index.*`（列出场景并可运行）
* 尝试自动把调试页注册到 `app.json` 的 pages；失败则输出手工操作提示

### 5.2 `sdd-lite add-module <modulePath>`

在 `<modulePath>/__sdd__/` 下生成骨架（幂等）：

* `helpers/sddTools.ts`
* `mocks/index.ts`
* `scenarios/README.md`

### 5.3 `sdd-lite add-scenario <modulePath>`

* 若模块未初始化 `__sdd__`，先自动执行 add-module
* 生成 `<modulePath>/__sdd__/scenarios/<id>.scenario.ts`
* 允许交互选择模板：`basic` / `api-variants`（第一版足够）
* note 必须写清楚人工怎么验证、看什么 log

### 5.4 `sdd-lite doctor`

* 静态检查：全局是否存在、入口注入是否存在、场景扫描是否能列出、重复 id、场景结构基础合规
* 小程序额外检查：manifest 是否生成、调试页是否存在、app.json 是否注册
* 输出 ✅/⚠️/❌ + 修复建议
* 支持 `--json` 输出（为未来工具化预留）

---

## 6. 非功能性要求（必须做到）

1. **幂等**：重复运行命令不会破坏现有文件，不会重复插入代码
2. **默认不覆盖用户内容**：已有文件默认跳过或仅补齐缺失；必要时生成 `.example` 文件
3. **变更报告**：命令执行后必须输出新增/修改/跳过的文件清单
4. **最少依赖**：尽量少引入新库（commander + prompts 足够）

---

## 7. 技术实现策略（建议，但可调整）

* Node + TypeScript CLI
* Core + Adapter 结构：

  * core：命令/文件系统/模板渲染/patch/doctor框架
  * adapters：`vue2` / `vue3` / `mp-wechat`
* discover 策略：

  * Web：一个 discover.ts 同时支持 Vite 与 Webpack
  * 小程序：由 CLI 生成 manifest.ts（静态 import），boot 读 manifest

---

## 8. 验收标准（最重要）

### Web 验收

* dev 环境启动后，控制台执行：

  * `window.SDD.list()` 能看到场景列表
  * `window.SDD.run(id)` 能执行对应 setup，且 run 前会 resetEnv
* 多次运行不同场景不会叠加副作用（依赖 runtime.onReset）

### 小程序验收

* 能打开调试页看到场景列表
* 点击运行能执行 setup，且切场景会 resetEnv
* manifest.ts 能正确列出场景（静态 import 路径正确）

---

## 9. 产出文件中必须包含给 agent 的规范文档

`AGENT_GUIDE.md` 必须随 init 生成，内容强调：

* 全局极薄
* 模块自治
* 场景结构固定
* 清理机制必须 runtime.onReset
* 可复现输入
* note 要写清楚人工验证步骤

---

这份背景信息就是 agent 的“施工图纸”。让它按这个来实现 CLI，别在全局放 helper，别搞重测试体系，别忘了小程序要 manifest + 调试页，doctor 必须有。
