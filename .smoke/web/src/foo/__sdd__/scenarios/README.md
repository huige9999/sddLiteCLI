# SDD Scenarios (module)

每个场景文件必须：

```ts
export default {
  id: string,
  title: string,
  note?: string,
  setup({ runtime, options }): void
}
```

注意：任何副作用都必须通过 `runtime.onReset` 登记清理，保证切换场景不污染环境。
