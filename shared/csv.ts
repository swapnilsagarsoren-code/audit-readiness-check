// RFC 4180 field escaping, with the explicitly requested LF record endings.
export function writeCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const quote = (value: unknown) => {
    const s = value == null ? '' : String(value);
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(row => headers.map(h => quote(row[h])).join(','))].join('\n') + '\n';
}
export function readCsv(text: string): Record<string, string>[] {
  if (text.startsWith('\uFEFF')) throw new Error('CSV must not have a BOM.');
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ',') { row.push(field); field = ''; closed = false; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; closed = false; }
    else if (closed || c === '"' || c === '\r') throw new Error('Malformed CSV.');
    else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  const headers = rows.shift(); if (!headers) throw new Error('Missing CSV header.');
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV header.');
  return rows.map(values => {
    if (values.length !== headers.length) throw new Error('CSV column count mismatch.');
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}
