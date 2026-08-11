-- Historical Expenses, Chit-profit rounds, and Final Settlement ledger,
-- imported from JFC_Santha_Settlement_2026.xlsx

INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Pongal Program Advance (From: Veeramani -> To: Thangadurai)', 50000, '2021-03-31'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Registration charge - Partial (From: Veeramani -> To: UdhayaKumar)', 10000, '2022-05-13'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'JFC Registration expenses (From: Veeramani -> To: UdhayaKumar)', 8500, '2022-08-26'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'JFC Registration expenses (From: Veeramani -> To: UdhayaKumar)', 2000, '2022-09-07'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'JFC Registration expenses (From: Veeramani -> To: UdhayaKumar)', 1000, '2022-09-24'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Ravi''s Mothe Funeral expenses (From: Veeramani -> To: Rajamani)', 3000, '2022-12-13'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Rengaraj Fathers Funeral Expenses (From: Veeramani -> To: Ravi)', 2000, '2022-12-19'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Scanning Charges (From: Veeramani -> To: Rajamani)', 360, '2023-02-06'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'JFC Pongal Pooja Expensess (From: Veeramani -> To: Rajamani)', 200, '2023-05-12'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Rajamani''s Mother Funeral Expensess (From: Veeramani -> To: Ravi)', 3000, '2023-07-10'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Sangai ( Tree Plantation Donation ) (From: Veeramani -> To: Kanthasamy)', 2000, '2023-08-13'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'JFC Contribution for Murugan Temple Book (From: Veeramani -> To: Ravi)', 2000, '2024-01-21'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Renual Process (From: Veeramani -> To: Udhayakumar)', 11000, '2024-02-25'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));
INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id) VALUES ('MISCELLANEOUS', 'Renual Process (From: Veeramani -> To: Udhayakumar)', 1600, '2024-04-13'::timestamptz, (SELECT id FROM users WHERE login_username = 'Admin'));

INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-1 (3% Commission) - 1 Lakh', '21-22', 30000);
INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-2 (3% Commission) - 1 Lakh', '21-22', 30000);
INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-3 (3% Commission) - 1 Lakh', '21-22', 30000);
INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-4 (3% Commission) - 2 Lakh', '22-23', 60000);
INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-5 (3% Commission) - 50K', '22-23', 15000);
INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-6 (2.5% Commission) - 1 Lakh', '23-24', 25000);
INSERT INTO chit_profit_history (label, fiscal_year_label, profit_amount) VALUES ('Chit-7 (2.5% Commission) - 2 Lakh', '23-24', 50000);

INSERT INTO settlement_summary (fiscal_year_label, santha_donation, chit_profit, expenses, principal, profit_6pct) VALUES ('21-22', 275000, 90000, 50000, 315000, 94500);
INSERT INTO settlement_summary (fiscal_year_label, santha_donation, chit_profit, expenses, principal, profit_6pct) VALUES ('22-23', 79000, 75000, 26860, 127140, 30513.6);
INSERT INTO settlement_summary (fiscal_year_label, santha_donation, chit_profit, expenses, principal, profit_6pct) VALUES ('23-24', 4500, 75000, 19800, 59700, 7164);
