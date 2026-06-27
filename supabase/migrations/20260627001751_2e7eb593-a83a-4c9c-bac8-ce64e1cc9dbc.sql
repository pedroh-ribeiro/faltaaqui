DROP TRIGGER IF EXISTS trg_handle_new_group ON public.groups;
CREATE TRIGGER trg_handle_new_group
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

DROP TRIGGER IF EXISTS trg_enforce_free_plan_group_limit ON public.groups;
CREATE TRIGGER trg_enforce_free_plan_group_limit
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_group_limit();

DROP TRIGGER IF EXISTS trg_add_owner_as_member ON public.groups;
CREATE TRIGGER trg_add_owner_as_member
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();