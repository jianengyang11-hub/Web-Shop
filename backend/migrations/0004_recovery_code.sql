-- Self-service "forgot PIN" recovery: each staff row can hold a one-time-use recovery code
-- (hashed the same way as a PIN). No email/SMS provider involved — the code is shown to the
-- owner once, at creation time or on demand, and they're responsible for storing it themselves.

ALTER TABLE staff ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE staff ADD COLUMN recovery_code_salt TEXT;
