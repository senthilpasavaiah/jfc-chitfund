const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function formatINR(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function chitLabel(c) {
  return c.type === 'historical' ? `${c.refNumber} (${c.status})` : c.refNumber;
}

function toCSV(report) {
  const lines = [];
  lines.push('Jolly Friends Club - Association Financial Report');
  lines.push(`Period,${report.period}`);
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
    { metric: 'Period', value: report.period },
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
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Jolly Friends Club — Association Financial Report', { align: 'center' });
    doc.fontSize(10).fillColor('#666').text(`Period: ${report.period}`, { align: 'center' });
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
