/**
 * Utility to generate CSV content from headers and rows
 */
export function generateCsv(headers: string[], rows: any[][]): string {
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      val = JSON.stringify(val);
    }
    let str = String(val);
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const dataRows = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
  return `${headerRow}\n${dataRows}`;
}

/**
 * Utility to parse CSV content into rows and cells
 */
export function parseCsv(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' || char === '\r') {
        row.push(cell.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          result.push(row);
        }
        row = [];
        cell = '';
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
      } else {
        cell += char;
      }
    }
  }

  if (row.length > 0 || cell !== '') {
    row.push(cell.trim());
    if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
      result.push(row);
    }
  }

  return result;
}
