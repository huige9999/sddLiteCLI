export default {
  id: "hello",
  title: "Hello",
  note: [
    "人工验证：",
    "1) 打开目标页面/模块",
    "2) 运行 window.SDD.run(\"hello\")",
    "3) 观察 console log / UI 变化是否符合预期",
  ].join("\n"),
  setup({ runtime, options }) {
    console.log("[SDD] setup", "hello", { options });

    const timer = setInterval(() => {
      console.log("[SDD] tick", "hello");
    }, 1000);

    runtime.onReset(() => {
      clearInterval(timer);
    });
  },
};
