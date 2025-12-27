import readline from "node:readline";

export async function promptText(message, { defaultValue } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const q = defaultValue ? `${message} (${defaultValue}): ` : `${message}: `;
    const answer = await new Promise((resolve) => rl.question(q, resolve));
    const trimmed = String(answer).trim();
    return trimmed || defaultValue || "";
  } finally {
    rl.close();
  }
}

export async function promptSelect(message, options) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write(`${message}\n`);
    options.forEach((opt, idx) => {
      process.stdout.write(`  ${idx + 1}) ${opt}\n`);
    });
    const answer = await new Promise((resolve) => rl.question(`Select 1-${options.length}: `, resolve));
    const n = Number(String(answer).trim());
    if (!Number.isFinite(n) || n < 1 || n > options.length) {
      throw new Error(`Invalid selection: ${answer}`);
    }
    return options[n - 1];
  } finally {
    rl.close();
  }
}

