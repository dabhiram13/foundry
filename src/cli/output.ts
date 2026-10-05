type JsonRecord = Record<string, unknown>;

function scalar(value: unknown): string {
  if (value === null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function human(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    if (!value.length) return `${indent}(none)`;
    return value.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return `${indent}- ${scalar(item)}`;
      }
      const record = item as JsonRecord;
      const labelKey = ['name', 'id', 'slug', 'title'].find((key) => record[key] !== undefined);
      const label = labelKey ? record[labelKey] : 'item';
      const status = record.status ? ` (${String(record.status)})` : '';
      const details = Object.entries(record)
        .filter(([key]) => !['name', 'id', 'slug', 'status'].includes(key) && !(key === 'title' && labelKey === 'title'))
        .map(([key, child]) => {
          if (child !== null && typeof child === 'object') {
            return `${indent}  ${key}:\n${human(child, `${indent}    `)}`;
          }
          return `${indent}  ${key}: ${scalar(child)}`;
        });
      return [`${indent}- ${String(label)}${status}`, ...details].join('\n');
    }).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as JsonRecord).map(([key, child]) => {
      if (child !== null && typeof child === 'object') {
        return `${indent}${key}:\n${human(child, `${indent}  `)}`;
      }
      return `${indent}${key}: ${scalar(child)}`;
    }).join('\n');
  }
  return `${indent}${scalar(value)}`;
}

export function render(value: unknown, json: boolean): string {
  if (json) return `${JSON.stringify(value)}\n`;
  if (Array.isArray(value) && !value.length) return 'No results.\n';
  return `${human(value)}\n`;
}

export function writeResult(value: unknown, json: boolean): void {
  process.stdout.write(render(value, json));
}
