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

    doc.fontSize(18).text('Jolly Friends Club — Association Financial Report', { align: 'center' });
    doc.fontSize(10).fillColor('#666').text(`Period: ${periodLabel(report)}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(13).fillColor('#000').text('Association Income');
    doc.moveDown(0.3);
    doc.fontSize(10);
    for (const row of report.incomeBreakdown) {
      doc.text(`${row.label}: ${formatINR(row.amount)}`);
    }
    doc.font('Helvetica-Bold').text(`Total Income: ${formatINR(report.association.income.total)}`);
    doc.font('Helvetica');
    doc.moveDown(1);

    doc.fontSize(13).text('Association Expenses');
    doc.moveDown(0.3);
    doc.fontSize(10);
    for (const row of report.expenseBreakdown) {
      doc.text(`${row.label}: ${formatINR(row.amount)}`);
    }
    doc.font('Helvetica-Bold').text(`Total Expenses: ${formatINR(report.association.expenses.total)}`);
    doc.font('Helvetica');
    doc.moveDown(1);

    doc.fontSize(13).text('Net Profit / Surplus');
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica-Bold').text(formatINR(report.association.netProfit));
    doc.font('Helvetica');
    doc.moveDown(1);

    doc.fontSize(13).text('Chit-wise Financial Summary');
    doc.moveDown(0.3);
    doc.fontSize(9);
    for (const c of report.chitSummary) {
      const expensePart = c.expense === null ? '' : `  |  Expenses: ${formatINR(c.expense)}`;
      doc.text(`${chitLabel(c)}  |  ${c.status}  |  Income: ${formatINR(c.income)}${expensePart}  |  Net: ${formatINR(c.net)}`);
    }

    doc.end();
  });
}

module.exports = { toCSV, toExcel, toPDF };
