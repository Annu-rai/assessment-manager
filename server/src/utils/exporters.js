import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Export helpers (Module 26). Turn a list of row objects + a column spec into
 * CSV text, an .xlsx buffer, or a streamed PDF table.
 * `columns` = [{ key, label, width? }].
 */

// --- CSV ---
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(columns, rows) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

// --- Excel (.xlsx) ---
export async function toXlsxBuffer(columns, rows, sheetName = 'Export') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: c.width || 22 }));
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF0FF' } };
  return wb.xlsx.writeBuffer();
}

// --- PDF (simple table) ---
export function streamTablePdf(res, { title, columns, rows, filename }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename || 'export'}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827').text(title);
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text(`Generated ${new Date().toLocaleString()} · ${rows.length} rows`);
  doc.moveDown(0.6);

  const startX = doc.page.margins.left;
  const usableW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = usableW / columns.length;
  let y = doc.y;

  const drawRow = (values, { bold = false, fill = null } = {}) => {
    const rowH = 20;
    if (y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
    }
    if (fill) doc.rect(startX, y, usableW, rowH).fill(fill);
    doc.fillColor('#111827').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    values.forEach((v, i) => {
      doc.text(String(v ?? ''), startX + i * colW + 4, y + 6, { width: colW - 8, ellipsis: true, lineBreak: false });
    });
    y += rowH;
  };

  drawRow(columns.map((c) => c.label), { bold: true, fill: '#eef0ff' });
  rows.forEach((r, idx) => drawRow(columns.map((c) => r[c.key]), { fill: idx % 2 ? '#f8fafc' : null }));

  doc.end();
}

// Helper: send CSV / XLSX with download headers.
export async function sendExport(res, format, { columns, rows, basename, sheetName, title }) {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.csv"`);
    return res.send(toCSV(columns, rows));
  }
  if (format === 'xlsx') {
    const buf = await toXlsxBuffer(columns, rows, sheetName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${basename}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  if (format === 'pdf') {
    return streamTablePdf(res, { title, columns, rows, filename: basename });
  }
  res.status(400);
  throw new Error('Unsupported format (use csv, xlsx, or pdf)');
}
