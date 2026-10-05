type JsonRecord = Record<string, unknown>;

function scalar(value: unknown): string {
  if (value === null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function render(value: unknown, json: boolean): string {
  if (json) return `${JSON.stringify(value)}\n`;
  if (Array.isArray(value)) {
    if (!value.length) return 'No results.\n';
    return `${value.map((item) => {
      if (typeof item !== 'object' || item === null) return `- ${scalar(item)}`;
      const record = item as JsonRecord;
      const label = record.name ?? record.id ?? record.slug ?? 'item';
      const status = record.status ? ` (${String(record.status)})` : '';
      return `- ${String(label)}${status}`;
    }).join('\n')}\n`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as JsonRecord;
    const summary = Object.entries(record)
      .filter(([, child]) => child === null || ['string', 'number', 'boolean'].includes(typeof child))
      .map(([key, child]) => `${key}: ${scalar(child)}`);
    if (summary.length) return `${summary.join('\n')}\n`;
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeResult(value: unknown, json: boolean): void {
  process.stdout.write(render(value, json));
}
