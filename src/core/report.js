export function createReport({ title } = {}) {
  return /** @type {{ title?: string, added: string[], modified: string[], skipped: string[], notes: string[] }} */ ({
    title,
    added: [],
    modified: [],
    skipped: [],
    notes: [],
  });
}

export function printReport(report) {
  const lines = [];
  if (report.title) lines.push(`== ${report.title} ==`);
  const pushGroup = (label, items) => {
    if (!items.length) return;
    lines.push(`${label} (${items.length})`);
    for (const p of items) lines.push(`  - ${p}`);
  };

  pushGroup("ADD", report.added);
  pushGroup("MOD", report.modified);
  pushGroup("SKIP", report.skipped);
  pushGroup("NOTE", report.notes);

  process.stdout.write(`${lines.join("\n")}\n`);
}
