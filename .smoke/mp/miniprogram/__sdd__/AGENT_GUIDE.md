# AGENT_GUIDE (SDD-lite / 小程序)

规则同 Web：

1. 全局极薄：只放 runtime/boot/manifest
2. 模块自治：helpers/mocks/scenarios 必须在模块内
3. 场景结构固定 + onReset 清理优先
