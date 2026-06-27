-- 1. Restrict invite_code column to owners only
REVOKE SELECT (invite_code) ON public.groups FROM anon, authenticated;
GRANT SELECT (id, name, owner_id, created_at) ON public.groups TO authenticated;

-- Owner-only RPC to fetch the invite code
CREATE OR REPLACE FUNCTION public.get_group_invite_code(_group_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT invite_code INTO _code FROM public.groups
    WHERE id = _group_id AND owner_id = auth.uid();
  IF _code IS NULL THEN RAISE EXCEPTION 'not_owner'; END IF;
  RETURN _code;
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_group_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_invite_code(uuid) TO authenticated;

-- 2. Lock down group_members INSERT: direct inserts only by group owner.
-- All other joins must go through join_group_by_code (SECURITY DEFINER bypasses RLS).
DROP POLICY IF EXISTS "insert own membership" ON public.group_members;
CREATE POLICY "owner inserts own membership"
ON public.group_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
);

-- 3. Lock down SECURITY DEFINER helpers from anonymous role.
REVOKE EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_group_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;