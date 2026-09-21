-- Your 7 historical (pre-app) chit rounds are recorded in
-- chit_profit_history as "Chit-1" through "Chit-7". The chits you create in
-- the live app should continue that numbering (008, 009, 010...), not
-- restart at 001. This renumbers the 3 existing live chits to match.

UPDATE chits SET ref_number = 'CHIT-2026-008' WHERE ref_number = 'CHIT-2026-001';
UPDATE chits SET ref_number = 'CHIT-2026-009' WHERE ref_number = 'CHIT-2026-002';
UPDATE chits SET ref_number = 'CHIT-2026-010' WHERE ref_number = 'CHIT-2026-003';
