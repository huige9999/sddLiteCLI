export function createReport() {
  return /** @type {{ added: string[], modified: string[], skipped: string[], notes: string[] }} */ ({
    added: [],
    modified: [],
    skipped: [],
    notes: [],
  });
}

export function printReport(report) {
  const lines = [];
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

