const express = require('express');
const { query: queryValidator } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const reportService = require('../services/report.service');
const { toCSV, toExcel, toPDF } = require('../utils/reportExport');

const router = express.Router();
router.use(authenticate);

const rules = [
  queryValidator('period').optional().isIn(['monthly', 'quarterly', 'half-yearly', 'yearly', 'historical']),
  queryValidator('from').optional().isISO8601(),
  queryValidator('to').optional().isISO8601(),
];

router.get('/', rules, validate, async (req, res) => {
  const report = await reportService.buildReport(req.query);
  res.json({ success: true, data: report });
});

router.get(
  '/export',
  [...rules, queryValidator('format').isIn(['csv', 'xlsx', 'pdf'])],
  validate,
  async (req, res) => {
    const report = await reportService.buildReport(req.query);
    const filename = `jfc-report-${report.period}-${new Date().toISOString().slice(0, 10)}`;

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(toCSV(report));
    }
    if (req.query.format === 'xlsx') {
      const buffer = await toExcel(report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }
    if (req.query.format === 'pdf') {
      const buffer = await toPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(buffer);
    }
  }
);

module.exports = router;
