-- Task attachments now also use Qiniu. Do not report their keys as missing
-- objects in the Supabase "exams" bucket. Preserve existing access checks.
DO $migration$
DECLARE
  current_definition text;
  original_predicate text := $old$where e.storage_path is not null and e.storage_path <> ''$old$;
  updated_predicate text := $new$where e.storage_path is not null and e.storage_path <> ''
        and coalesce(e.storage_backend,'supabase') <> 'qiniu'
        and e.storage_path !~ '^(videos|archives|submissions)/'$new$;
BEGIN
  current_definition := pg_get_functiondef('public.get_storage_health()'::regprocedure);
  IF strpos(current_definition, updated_predicate) > 0 THEN
    RETURN;
  END IF;
  IF strpos(current_definition, original_predicate) = 0 THEN
    RAISE EXCEPTION 'Unexpected exams storage predicate; review get_storage_health before applying';
  END IF;
  EXECUTE replace(current_definition, original_predicate, updated_predicate);
END;
$migration$;
