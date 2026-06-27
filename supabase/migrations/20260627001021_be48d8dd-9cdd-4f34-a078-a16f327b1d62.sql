GRANT EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;