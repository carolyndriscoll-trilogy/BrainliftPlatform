-- DOK4 Cascading State Invalidation Triggers
-- When foundation data (DOK1 facts, DOK2 summaries, DOK3 insights) linked to a DOK4 submission
-- is updated or deleted, mark the DOK4 submission as needing recalculation.

-- Trigger function: Invalidate DOK4 submissions when linked DOK3 insights change
CREATE OR REPLACE FUNCTION cascade_dok4_on_dok3_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dok4_submissions
  SET needs_recalculation = true,
      recalculation_reason = 'Linked DOK3 insight was ' || TG_OP || 'd',
      recalculation_triggered_at = NOW()
  WHERE id IN (
    SELECT dl.submission_id
    FROM dok4_dok3_links dl
    WHERE dl.dok3_insight_id = COALESCE(OLD.id, NEW.id)
  )
  AND needs_recalculation = false;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Invalidate DOK4 submissions when linked DOK2 summaries change
CREATE OR REPLACE FUNCTION cascade_dok4_on_dok2_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dok4_submissions
  SET needs_recalculation = true,
      recalculation_reason = 'Linked DOK2 summary was ' || TG_OP || 'd',
      recalculation_triggered_at = NOW()
  WHERE id IN (
    SELECT dl.submission_id
    FROM dok4_dok2_links dl
    WHERE dl.dok2_summary_id = COALESCE(OLD.id, NEW.id)
  )
  AND needs_recalculation = false;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Invalidate DOK4 submissions when DOK1 facts linked via DOK2 change
CREATE OR REPLACE FUNCTION cascade_dok4_on_dok1_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Find DOK4 submissions linked to DOK2 summaries that reference this fact
  UPDATE dok4_submissions
  SET needs_recalculation = true,
      recalculation_reason = 'DOK1 fact (id=' || COALESCE(OLD.id, NEW.id) || ') was ' || TG_OP || 'd',
      recalculation_triggered_at = NOW()
  WHERE id IN (
    SELECT DISTINCT d4l.submission_id
    FROM dok4_dok2_links d4l
    JOIN dok2_fact_relations dfr ON dfr.dok2_summary_id = d4l.dok2_summary_id
    WHERE dfr.fact_id = COALESCE(OLD.id, NEW.id)
  )
  AND needs_recalculation = false;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Invalidate DOK4 submissions when link tables change
CREATE OR REPLACE FUNCTION cascade_dok4_on_link_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dok4_submissions
  SET needs_recalculation = true,
      recalculation_reason = 'Link relationship changed in ' || TG_TABLE_NAME,
      recalculation_triggered_at = NOW()
  WHERE id = COALESCE(OLD.submission_id, NEW.submission_id)
  AND needs_recalculation = false;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to DOK3 insights table
DROP TRIGGER IF EXISTS dok4_cascade_dok3_update ON dok3_insights;
CREATE TRIGGER dok4_cascade_dok3_update
  AFTER UPDATE OF text, score ON dok3_insights
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_dok3_change();

DROP TRIGGER IF EXISTS dok4_cascade_dok3_delete ON dok3_insights;
CREATE TRIGGER dok4_cascade_dok3_delete
  AFTER DELETE ON dok3_insights
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_dok3_change();

-- Apply triggers to DOK2 summaries table
DROP TRIGGER IF EXISTS dok4_cascade_dok2_update ON dok2_summaries;
CREATE TRIGGER dok4_cascade_dok2_update
  AFTER UPDATE OF grade ON dok2_summaries
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_dok2_change();

DROP TRIGGER IF EXISTS dok4_cascade_dok2_delete ON dok2_summaries;
CREATE TRIGGER dok4_cascade_dok2_delete
  AFTER DELETE ON dok2_summaries
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_dok2_change();

-- Apply triggers to facts table (DOK1)
DROP TRIGGER IF EXISTS dok4_cascade_dok1_update ON facts;
CREATE TRIGGER dok4_cascade_dok1_update
  AFTER UPDATE OF score ON facts
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_dok1_change();

DROP TRIGGER IF EXISTS dok4_cascade_dok1_delete ON facts;
CREATE TRIGGER dok4_cascade_dok1_delete
  AFTER DELETE ON facts
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_dok1_change();

-- Apply triggers to DOK4 link tables
DROP TRIGGER IF EXISTS dok4_cascade_dok3_link_change ON dok4_dok3_links;
CREATE TRIGGER dok4_cascade_dok3_link_change
  AFTER INSERT OR UPDATE OR DELETE ON dok4_dok3_links
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_link_change();

DROP TRIGGER IF EXISTS dok4_cascade_dok2_link_change ON dok4_dok2_links;
CREATE TRIGGER dok4_cascade_dok2_link_change
  AFTER INSERT OR UPDATE OR DELETE ON dok4_dok2_links
  FOR EACH ROW EXECUTE FUNCTION cascade_dok4_on_link_change();
