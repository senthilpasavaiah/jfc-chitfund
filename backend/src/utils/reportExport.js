const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');

// The prepared club letterhead - see docs/LETTERHEAD_TEMPLATE_SPEC.md for
// the exact page/safe-area spec this was built to (A4, 300 DPI,
// 2480x3508px). Drawn as a full-page background on every page of the PDF
// export; report content is confined to the same safe area the spec
// defines so it never overlaps the header or footer artwork.
const LETTERHEAD_PATH = path.join(__dirname, '..', '..', 'assets', 'letterhead.png');

// A4 in points, and the safe-area margins from the spec, converted from mm
// (1mm = 2.83465pt): header 40mm, footer 20mm, left/right 15mm each.
const MM_TO_PT = 2.83465;
const PAGE_MARGINS = {
  top: 40 * MM_TO_PT,
  bottom: 20 * MM_TO_PT,
  left: 15 * MM_TO_PT,
  right: 15 * MM_TO_PT,
};

function formatINR(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function chitLabel(c) {
  return c.type === 'historical' ? `${c.refNumber} (${c.status})` : c.refNumber;
}

/** A human-readable description of what date range the report covers -
 * used instead of the raw internal `period` keyword, which is either a
 * generic label ('custom') or wouldn't exist at all for a Management-driven
 * export (Previous/New Management, or the two intersected with a date
 * filter) - those always resolve to an explicit range with no matching
 * named period. */
function periodLabel(report) {
  if (report.period === 'historical') return 'All-time';
  if (report.range?.from && report.range?.to) {
    const from = new Date(report.range.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const to = new Date(report.range.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${from} to ${to}`;
  }
  return report.period;
}

function toCSV(report) {
  const lines = [];
  lines.push('Jolly Friends Club - Association Financial Report');
  lines.push(`Period,${periodLabel(report)}`);
  lines.push('');

  lines.push('Association Income');
  lines.push('Source,Amount');
  for (const row of report.incomeBreakdown) {
    lines.push(`"${row.label}",${row.amount}`);
  }
  lines.push(`Total Income,${report.association.income.total}`);
  lines.push('');

  lines.push('Association Expenses');
  lines.push('Source,Amount');
  for (const row of report.expenseBreakdown) {
    lines.push(`"${row.label}",${row.amount}`);
  }
  lines.push(`Total Expenses,${report.association.expenses.total}`);
  lines.push('');

  lines.push('Net Profit / Surplus');
  lines.push(`Net,${report.association.netProfit}`);
  lines.push('');

  lines.push('Chit-wise Financial Summary');
  lines.push('Chit,Status,Income,Expenses,Net Result');
  for (const c of report.chitSummary) {
    lines.push(`"${chitLabel(c)}",${c.status},${c.income},${c.expense ?? ''},${c.net}`);
  }
  return lines.join('\n');
}

async function toExcel(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JFC Chit Fund System';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 34 }, { header: 'Value', key: 'value', width: 20 }];
  summarySheet.addRows([
    { metric: 'Period', value: periodLabel(report) },
    { metric: '', value: '' },
    { metric: 'Association Income', value: '' },
    ...report.incomeBreakdown.map((r) => ({ metric: r.label, value: r.amount })),
    { metric: 'Total Income', value: report.association.income.total },
    { metric: '', value: '' },
    { metric: 'Association Expenses', value: '' },
    ...report.expenseBreakdown.map((r) => ({ metric: r.label, value: r.amount })),
    { metric: 'Total Expenses', value: report.association.expenses.total },
    { metric: '', value: '' },
    { metric: 'Net Profit / Surplus', value: report.association.netProfit },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  const chitSheet = workbook.addWorksheet('Chit-wise Summary');
  chitSheet.columns = [
    { header: 'Chit', key: 'chit', width: 30 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Income', key: 'income', width: 16 },
    { header: 'Expenses', key: 'expense', width: 16 },
    { header: 'Net Result', key: 'net', width: 16 },
  ];
  chitSheet.addRows(
    report.chitSummary.map((c) => ({
      chit: chitLabel(c),
      status: c.status,
      income: c.income,
      expense: c.expense ?? '',
      net: c.net,
    }))
  );
  chitSheet.getRow(1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

function toPDF(report) {
  const NAVY_HEX = '#193250';
  const GOLD_HEX = '#B8863E'; // darker than the brand gold for readable small text
  const ZEBRA_HEX = '#F3F5F8';
  const BORDER_HEX = '#D8DCE3';
  const TOTAL_BG_HEX = '#EDEFF3';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: PAGE_MARGINS });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Draw the letterhead full-bleed (0,0 to the exact page size) on every
    // page - the first one now, and every subsequent one PDFKit adds on
    // its own when content overflows the margins above (that's what makes
    // page breaks "just work": doc.text()'s own pagination already stays
    // inside PAGE_MARGINS, so it never has to touch the header/footer art).
    function drawLetterhead() {
      doc.image(LETTERHEAD_PATH, 0, 0, { width: doc.page.width, height: doc.page.height });
    }
    doc.on('pageAdded', drawLetterhead);
    drawLetterhead();

    const contentW = doc.page.width - PAGE_MARGINS.left - PAGE_MARGINS.right;

    // Adds a new page (redrawing the letterhead via the listener above) if
    // `needed` more points won't fit before the footer safe-area line.
    // Returns whether a break happened, so callers can redraw a table's
    // header row on the fresh page - matching how real bank/card statements
    // repeat their column headings on every continuation page.
    function ensureSpace(needed, onBreak) {
      const bottom = doc.page.height - PAGE_MARGINS.bottom;
      if (doc.y + needed > bottom) {
        doc.addPage();
        doc.y = PAGE_MARGINS.top;
        if (onBreak) onBreak();
        return true;
      }
      return false;
    }

    function drawTableHeaderRow(cols, rowH) {
      const x0 = PAGE_MARGINS.left;
      const y = doc.y;
      doc.rect(x0, y, contentW, rowH).fill(NAVY_HEX);
      let cx = x0;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#FFFFFF');
      cols.forEach((col) => {
        doc.text(col.label, cx + 8, y + 7, { width: col.width - 16, align: col.align || 'left' });
        cx += col.width;
      });
      doc.y = y + rowH;
    }

    function drawDataRow(cols, values, { zebra, bold, bg, textColor } = {}, rowH) {
      const x0 = PAGE_MARGINS.left;
      const y = doc.y;
      const fillColor = bg || (zebra ? ZEBRA_HEX : null);
      if (fillColor) doc.rect(x0, y, contentW, rowH).fill(fillColor);
      let cx = x0;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(textColor || '#1A1A1A');
      cols.forEach((col, i) => {
        doc.text(String(values[i]), cx + 8, y + 6, { width: col.width - 16, align: col.align || 'left' });
        cx += col.width;
      });
      doc.moveTo(x0, y + rowH).lineTo(x0 + contentW, y + rowH).lineWidth(0.5).strokeColor(BORDER_HEX).stroke();
      doc.y = y + rowH;
    }

    // A bank/credit-card-statement-style table: shaded header row (repeats
    // on every continuation page), zebra-striped body rows, a light rule
    // under each row - instead of the plain colon-separated text lines
    // this export used to produce.
    function drawTable({ columns, rows, rowH = 22, headerRowH = 24 }) {
      const cols = columns.map((c) => ({ ...c, width: c.width * contentW }));
      ensureSpace(headerRowH);
      drawTableHeaderRow(cols, headerRowH);
      rows.forEach((row, i) => {
        ensureSpace(rowH, () => drawTableHeaderRow(cols, headerRowH));
        drawDataRow(cols, row.values, { zebra: !row.bold && i % 2 === 1, bold: row.bold, bg: row.bg, textColor: row.textColor }, rowH);
      });
    }

    // Period, right-aligned under the header - no separate report title,
    // the letterhead itself already carries the club's identity.
    doc.font('Helvetica').fontSize(10).fillColor('#555555').text(`Period: ${periodLabel(report)}`, PAGE_MARGINS.left, doc.y, { width: contentW, align: 'right' });
    doc.moveDown(1.1);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY_HEX).text('Association Summary', PAGE_MARGINS.left, doc.y);
    doc.moveDown(0.4);
    drawTable({
      columns: [
        { label: 'Description', width: 0.7, align: 'left' },
        { label: 'Amount', width: 0.3, align: 'right' },
      ],
      rows: [
        ...report.incomeBreakdown.map((r) => ({ values: [r.label, formatINR(r.amount)] })),
        { values: ['Total Income', formatINR(report.association.income.total)], bold: true, bg: TOTAL_BG_HEX },
        ...report.expenseBreakdown.map((r) => ({ values: [r.label, formatINR(r.amount)] })),
        { values: ['Total Expenses', formatINR(report.association.expenses.total)], bold: true, bg: TOTAL_BG_HEX },
      ],
    });

    doc.moveDown(0.7);
    ensureSpace(34);
    const barY = doc.y;
    doc.rect(PAGE_MARGINS.left, barY, contentW, 34).fill(NAVY_HEX);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('Net Profit / Surplus', PAGE_MARGINS.left + 12, barY + 10, { width: contentW * 0.6, align: 'left' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#F0C674').text(formatINR(report.association.netProfit), PAGE_MARGINS.left, barY + 9, { width: contentW - 12, align: 'right' });
    doc.y = barY + 34;
    doc.moveDown(1.1);

    ensureSpace(40);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY_HEX).text('Chit-wise Financial Summary', PAGE_MARGINS.left, doc.y);
    doc.moveDown(0.4);
    drawTable({
      columns: [
        { label: 'Chit', width: 0.28, align: 'left' },
        { label: 'Status', width: 0.14, align: 'left' },
        { label: 'Income', width: 0.19, align: 'right' },
        { label: 'Expenses', width: 0.19, align: 'right' },
        { label: 'Net', width: 0.2, align: 'right' },
      ],
      rows: report.chitSummary.map((c) => ({
        values: [chitLabel(c), c.status, formatINR(c.income), c.expense === null ? '\u2014' : formatINR(c.expense), formatINR(c.net)],
      })),
    });

    doc.end();
  });
}

module.exports = { toCSV, toExcel, toPDF };
