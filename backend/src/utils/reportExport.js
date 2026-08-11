const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

function formatINR(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function toCSV(report) {
  const lines = [];
  lines.push('JFC Chit Fund Report');
  lines.push(`Period,${report.period}`);
  lines.push('');
  lines.push('Summary');
  lines.push('Metric,Value');
  lines.push(`Total Collected,${report.summary.totalCollected}`);
  lines.push(`Payment Count,${report.summary.paymentCount}`);
  lines.push(`Total Expenses,${report.summary.totalExpenses}`);
  lines.push(`Net,${report.summary.net}`);
  lines.push('');
  lines.push('Monthly Breakdown');
  lines.push('Month,Collected');
  for (const m of report.monthlyBreakdown) {
    lines.push(`${new Date(m.month).toISOString().slice(0, 7)},${m.collected}`);
  }
  lines.push('');
  lines.push('Chit Breakdown');
  lines.push('Reference,Name,Status,Collected,Payment Count');
  for (const c of report.chitBreakdown) {
    lines.push(`${c.refNumber},"${c.name}",${c.status},${c.collected},${c.paymentCount}`);
  }
  lines.push('');
  lines.push('Member Breakdown');
  lines.push('Name,Mobile,Total Paid,Payment Count');
  for (const m of report.memberBreakdown) {
    lines.push(`"${m.name}",${m.mobileNumber},${m.totalPaid},${m.paymentCount}`);
  }
  return lines.join('\n');
}

async function toExcel(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JFC Chit Fund System';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 30 }, { header: 'Value', key: 'value', width: 20 }];
  summarySheet.addRows([
    { metric: 'Period', value: report.period },
    { metric: 'Total Collected', value: report.summary.totalCollected },
    { metric: 'Payment Count', value: report.summary.paymentCount },
    { metric: 'Total Expenses', value: report.summary.totalExpenses },
    { metric: 'Net', value: report.summary.net },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  const monthlySheet = workbook.addWorksheet('Monthly');
  monthlySheet.columns = [{ header: 'Month', key: 'month', width: 15 }, { header: 'Collected', key: 'collected', width: 18 }];
  monthlySheet.addRows(report.monthlyBreakdown.map((m) => ({ month: new Date(m.month).toISOString().slice(0, 7), collected: m.collected })));
  monthlySheet.getRow(1).font = { bold: true };

  const chitSheet = workbook.addWorksheet('By Chit');
  chitSheet.columns = [
    { header: 'Reference', key: 'ref', width: 22 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Collected', key: 'collected', width: 16 },
    { header: 'Payments', key: 'count', width: 12 },
  ];
  chitSheet.addRows(report.chitBreakdown.map((c) => ({ ref: c.refNumber, name: c.name, status: c.status, collected: c.collected, count: c.paymentCount })));
  chitSheet.getRow(1).font = { bold: true };

  const memberSheet = workbook.addWorksheet('By Member');
  memberSheet.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Mobile', key: 'mobile', width: 18 },
    { header: 'Total Paid', key: 'total', width: 16 },
    { header: 'Payments', key: 'count', width: 12 },
  ];
  memberSheet.addRows(report.memberBreakdown.map((m) => ({ name: m.name, mobile: m.mobileNumber, total: m.totalPaid, count: m.paymentCount })));
  memberSheet.getRow(1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

function toPDF(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Jolly Friends Club — Chit Fund Report', { align: 'center' });
    doc.fontSize(10).fillColor('#666').text(`Period: ${report.period}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(13).fillColor('#000').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Total Collected: ${formatINR(report.summary.totalCollected)}`);
    doc.text(`Payment Count: ${report.summary.paymentCount}`);
    doc.text(`Total Expenses: ${formatINR(report.summary.totalExpenses)}`);
    doc.text(`Net: ${formatINR(report.summary.net)}`);
    doc.moveDown(1);

    doc.fontSize(13).text('By Chit');
    doc.moveDown(0.3);
    doc.fontSize(9);
    for (const c of report.chitBreakdown) {
      doc.text(`${c.refNumber}  |  ${c.name}  |  ${c.status}  |  Collected: ${formatINR(c.collected)}  |  ${c.paymentCount} payment(s)`);
    }
    doc.moveDown(1);

    doc.fontSize(13).text('By Member');
    doc.moveDown(0.3);
    doc.fontSize(9);
    for (const m of report.memberBreakdown) {
      doc.text(`${m.name}  |  ${m.mobileNumber}  |  Paid: ${formatINR(m.totalPaid)}  |  ${m.paymentCount} payment(s)`);
    }

    doc.end();
  });
}

module.exports = { toCSV, toExcel, toPDF };
