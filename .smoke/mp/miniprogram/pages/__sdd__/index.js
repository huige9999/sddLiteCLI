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
