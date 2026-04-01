-- 013: Recover legacy decision reasoning from companion memory content when available.

UPDATE decisions d
SET
  reasoning = CASE
    WHEN legacy.content_text LIKE d.title || ': %'
      THEN substring(legacy.content_text FROM char_length(d.title) + 3)
    ELSE legacy.content_text
  END,
  reasoning_state = 'legacy_recovered'
FROM memory_items m
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN left(m.content::text, 1) = '{' THEN m.content::jsonb->>'text'
    ELSE NULL
  END AS content_text
) legacy
WHERE d.memory_item_id = m.id
  AND d.reasoning_state = 'legacy_unrecoverable'
  AND d.reasoning = 'none'
  AND legacy.content_text IS NOT NULL
  AND legacy.content_text <> '';
