import * as XLSX from 'xlsx';

export function exportToExcel(headers: string[], rows: any[][], sheetName: string, filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
