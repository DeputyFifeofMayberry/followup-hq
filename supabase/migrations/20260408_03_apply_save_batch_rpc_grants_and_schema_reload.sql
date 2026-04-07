-- Ensure apply_save_batch is executable from PostgREST and refresh schema cache.
-- This migration is safe to run repeatedly.

grant execute on function public.apply_save_batch(jsonb) to authenticated;

-- Refresh PostgREST schema cache so newly-created/updated RPC signatures are exposed.
notify pgrst, 'reload schema';
