export default {
  id: "demo.basic",
  title: "Demo Basic",
  note: [
    "人工验证：",
    "1) 打开目标页面/模块",
    "2) 运行 window.SDD.run(\"demo.basic\")",
    "3) 观察 console log / UI 变化是否符合预期",
  ].join("\n"),
  setup({ runtime, options }) {
    console.log("[SDD] setup", "demo.basic", { options });

    const timer = setInterval(() => {
      console.log("[SDD] tick", "demo.basic");
    }, 1000);

    runtime.onReset(() => {
      clearInterval(timer);
    });
  },
};
