-- Adds the certificate S3 location column to the participant sheet.
-- Stores the S3 URI (s3://bucket/key) of the generated PDF certificate for each
-- participant. A bare object key is also accepted by the app (it falls back to
-- AWS_S3_BUCKET). Nullable: rows without a generated certificate stay NULL.
--
-- Target: downstream "mission" database (RDS). Run through the SSH tunnel, e.g.:
--   psql "host=127.0.0.1 port=5433 dbname=samarpanam user=postgres sslmode=require" \
--     -f scripts/sql/add-certificate-s3-location-column.sql
--
-- Idempotent — safe to run more than once.

ALTER TABLE mission.participant_data_sheet_set
  ADD COLUMN IF NOT EXISTS certificate_s3_location text;
