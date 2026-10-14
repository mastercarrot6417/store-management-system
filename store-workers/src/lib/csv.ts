/**
 * CSV files for the stock report export, opened mainly in Excel.
 */

export type CsvCell = string | number;

/**
 * Text that came from staff input (names, notes, reasons). A leading = + - @
 * would make Excel treat the cell as a formula, so it gets a ' in front.
 */
export function csvText(value: string | null | undefined): string {
  const text = value ?? "";
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function quote(cell: CsvCell): string {
  const text = String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Builds the file, with a byte-order mark so Excel reads it as UTF-8. */
export function toCsv(rows: CsvCell[][]): string {
  return "﻿" + rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n";
}
