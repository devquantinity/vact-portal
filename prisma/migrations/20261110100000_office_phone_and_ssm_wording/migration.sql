-- Data only (10 Nov 2026): replace the placeholder office phone with V ACT's real line, and drop the strike-off
-- sentence from the Annual Return email. Each update only touches rows that still hold the old value, so edits
-- made in the app are kept.
UPDATE "Setting"
SET "value" = '"+603-2011 8002"'::jsonb
WHERE "key" = 'staffPhone' AND "value" = '"+60 3-0000 0000"'::jsonb;

UPDATE "ReminderType"
SET "emailBody" = replace(
  "emailBody",
  'Late lodgement attracts a penalty from SSM under the Companies Act 2016, and repeated failures can lead to the company being struck off.',
  'Late lodgement attracts a penalty from SSM.'
)
WHERE "name" = 'Annual Return (SSM)'
  AND position('repeated failures can lead to the company being struck off' in "emailBody") > 0;
