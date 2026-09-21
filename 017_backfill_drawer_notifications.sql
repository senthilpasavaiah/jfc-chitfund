-- Backfills a Notifications row for every drawer assignment (Assign or
-- Shuffle) that already exists in chit_month_data but was set before this
-- notification-logging feature existed (e.g. via data import/seeding) -
-- CHIT-2026-008's Sept 2026 assignment to Barathan Uthan Malliah being the
-- example that prompted this. Notifications are only ever created going
-- forward at the moment an action happens (see NOTIFICATIONS.md) - this is
-- a one-time catch-up so the page isn't empty for assignments that predate
-- the feature, scoped to New Management (1 Jul 2026 onward) only, matching
-- the same cutover boundary used everywhere else in the app.
--
-- Safe to re-run: the NOT EXISTS check skips any (member, body) pair
-- that's already been logged, so running this twice won't duplicate rows.
--
-- Uses the oldest ADMIN user as created_by_id (notifications.created_by_id
-- is NOT NULL) since these were never actually dispatched by a specific
-- admin action - if your deployment has no ADMIN user yet, create one
-- first or this insert will fail on that NOT NULL constraint.

INSERT INTO notifications (member_id, channel, type, subject, body, status, created_by_id, created_at)
SELECT
  md.drawn_by_member_id,
  'WHATSAPP',
  'AUCTION_WON',
  CASE WHEN md.shuffled THEN 'You won this month''s shuffle!' ELSE 'You were assigned this month''s draw' END,
  CASE WHEN md.shuffled
    THEN m.name || ' was picked by shuffle for ' || c.ref_number || ' - ' ||
         to_char(c.start_date + (md.month_index || ' months')::interval, 'Mon YYYY') || '.'
    ELSE m.name || ' was assigned as the drawer for ' || c.ref_number || ' - ' ||
         to_char(c.start_date + (md.month_index || ' months')::interval, 'Mon YYYY') || '.'
  END AS body,
  'LOGGED',
  (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at ASC LIMIT 1),
  c.start_date + (md.month_index || ' months')::interval
FROM chit_month_data md
JOIN chits c ON c.id = md.chit_id
JOIN members m ON m.id = md.drawn_by_member_id
WHERE md.drawn_by_member_id IS NOT NULL
  AND c.start_date IS NOT NULL
  AND (c.start_date + (md.month_index || ' months')::interval) >= '2026-07-01'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.member_id = md.drawn_by_member_id
      AND n.type = 'AUCTION_WON'
      AND n.body = (
        CASE WHEN md.shuffled
          THEN m.name || ' was picked by shuffle for ' || c.ref_number || ' - ' ||
               to_char(c.start_date + (md.month_index || ' months')::interval, 'Mon YYYY') || '.'
          ELSE m.name || ' was assigned as the drawer for ' || c.ref_number || ' - ' ||
               to_char(c.start_date + (md.month_index || ' months')::interval, 'Mon YYYY') || '.'
        END
      )
  );
