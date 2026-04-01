-- 015: Reject fresh writes and mutations that try to use the legacy sentinel provenance.

CREATE OR REPLACE FUNCTION reject_legacy_provenance_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invocation_id = '00000000-0000-0000-0000-000000000000'::uuid
     OR NEW.source_path = 'system/pre-provenance' THEN
    RAISE EXCEPTION 'fresh % writes must not use legacy sentinel provenance', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_legacy_provenance_memory_items ON memory_items;
CREATE TRIGGER trg_reject_legacy_provenance_memory_items
BEFORE INSERT OR UPDATE ON memory_items
FOR EACH ROW
EXECUTE FUNCTION reject_legacy_provenance_write();

DROP TRIGGER IF EXISTS trg_reject_legacy_provenance_decisions ON decisions;
CREATE TRIGGER trg_reject_legacy_provenance_decisions
BEFORE INSERT OR UPDATE ON decisions
FOR EACH ROW
EXECUTE FUNCTION reject_legacy_provenance_write();

DROP TRIGGER IF EXISTS trg_reject_legacy_provenance_memory_embeddings ON memory_embeddings;
CREATE TRIGGER trg_reject_legacy_provenance_memory_embeddings
BEFORE INSERT OR UPDATE ON memory_embeddings
FOR EACH ROW
EXECUTE FUNCTION reject_legacy_provenance_write();

DROP TRIGGER IF EXISTS trg_reject_legacy_provenance_telemetry ON telemetry;
CREATE TRIGGER trg_reject_legacy_provenance_telemetry
BEFORE INSERT OR UPDATE ON telemetry
FOR EACH ROW
EXECUTE FUNCTION reject_legacy_provenance_write();
