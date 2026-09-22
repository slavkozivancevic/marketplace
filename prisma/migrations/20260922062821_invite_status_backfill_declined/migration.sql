-- Splits the legacy CANCELED status into the two endings it used to conflate.
--
-- CANCELED meant both "the invited person said no" and "the organization
-- withdrew it", so the invite page could only tell someone "already used or
-- canceled" - wrong, and alarming, for a person whose invite was simply pulled.
--
-- The audit log can tell the two apart: declining wrote member.invite_declined
-- with the invite id, revoking wrote nothing at all (that was the second bug,
-- fixed in the same change as this migration). Rows that can be proven to be
-- declines become DECLINED; everything else STAYS CANCELED rather than being
-- guessed into REVOKED. recordAudit is best-effort, so a missing entry is not
-- proof of a revoke, and a wrong guess here would be unrecoverable.
--
-- CANCELED remains in the enum as a tombstone for exactly these rows. Retire it
-- once none are left. Postgres forbids using an enum value in the transaction
-- that added it, which is why this is a second migration.
UPDATE "Invite" i
SET status = 'DECLINED'
WHERE i.status = 'CANCELED'
  AND EXISTS (
    SELECT 1
    FROM "AuditLog" a
    WHERE a."entityType" = 'Invite'
      AND a.action = 'member.invite_declined'
      AND a."entityId" = i.id
  );
