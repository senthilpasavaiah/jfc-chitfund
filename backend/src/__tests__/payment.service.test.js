const { calculateFine } = require('../services/payment.service');

describe('calculateFine', () => {
  it('returns 0 when paid before or on the due date', () => {
    const due = new Date('2026-01-15');
    const paid = new Date('2026-01-10');
    expect(calculateFine(100000, due, paid)).toBe(0);
  });

  it('charges 1% per week late', () => {
    const due = new Date('2026-01-01T00:00:00Z');
    const paid = new Date('2026-01-08T00:00:01Z'); // 1 week + 1 second late -> rounds up to 2 weeks
    const fine = calculateFine(100000, due, paid);
    expect(fine).toBe(2000); // 2 weeks * 1% * 100000
  });

  it('caps the fine at 10% of the base amount', () => {
    const due = new Date('2026-01-01');
    const paid = new Date('2026-06-01'); // ~5 months late
    const fine = calculateFine(100000, due, paid);
    expect(fine).toBe(10000); // capped at 10%
  });
});
