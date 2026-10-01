-- ═══════════════════════════════════════════════════════════════════════
-- TSOS v5.0.0 — Migration 004: Notifications & Messages (ADR-0014)
-- Run in the Supabase SQL editor (after 001 and 003).
-- Adds the tables powering the Figma Messages + Notifications surfaces.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Notifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'system'
    CHECK (category IN ('message','system','reminder','promotion','feedback')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_member_all" ON notifications;
CREATE POLICY "notifications_member_all" ON notifications
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = notifications.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  );

-- ── Conversations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'team' CHECK (kind IN ('team','personal')),
  name TEXT NOT NULL,
  member_names TEXT[],
  avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id, last_message_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_member_all" ON conversations;
CREATE POLICY "conversations_member_all" ON conversations
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = conversations.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  );

-- ── Conversation messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON conversation_messages(conversation_id, created_at ASC);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_messages_member_all" ON conversation_messages;
CREATE POLICY "conv_messages_member_all" ON conversation_messages
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = conversation_messages.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  );

-- ── Seed default team conversations for each existing tenant ──────────
INSERT INTO conversations (tenant_id, kind, name, member_names)
SELECT t.id, 'team', c.name, ARRAY['Front of House','Kitchen']
FROM tenants t
CROSS JOIN (VALUES ('Front of House'), ('Kitchen')) AS c(name)
WHERE NOT EXISTS (
  SELECT 1 FROM conversations cv WHERE cv.tenant_id = t.id AND cv.kind = 'team' AND cv.name = c.name
);
