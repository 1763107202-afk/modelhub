-- 2026-10-21: remove deprecated password-based guide statistics RPC; the site uses the owner-authenticated alternative.
-- Prevent direct authenticated calls to enqueue arbitrary Supabase Storage cleanup requests.
-- Leave public traffic statistics endpoints untouched because the public homepage relies on them.
revoke execute on function public.get_chatgpt_guide_visit_stats(text) from public, anon, authenticated;
revoke execute on function public.queue_storage_cleanup(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.queue_storage_cleanup(text,text,text,text,text) to service_role;
