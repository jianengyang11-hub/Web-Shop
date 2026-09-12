-- Adds PIN-based auth fields and Messenger credentials to tenants, and generalizes the inbound
-- message log from WhatsApp-only to any channel.

ALTER TABLE tenants ADD COLUMN pin_hash TEXT;
ALTER TABLE tenants ADD COLUMN pin_salt TEXT;
ALTER TABLE tenants ADD COLUMN messenger_page_id TEXT;
ALTER TABLE tenants ADD COLUMN messenger_access_token TEXT;
CREATE UNIQUE INDEX idx_tenants_messenger_page_id ON tenants(messenger_page_id);

ALTER TABLE whatsapp_messages RENAME TO channel_messages;
ALTER TABLE channel_messages ADD COLUMN channel TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK (channel IN ('WHATSAPP', 'MESSENGER'));
ALTER TABLE channel_messages RENAME COLUMN wa_message_id TO external_message_id;
