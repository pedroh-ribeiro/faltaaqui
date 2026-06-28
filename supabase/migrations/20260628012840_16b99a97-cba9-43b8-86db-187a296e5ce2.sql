DROP TRIGGER IF EXISTS groups_before_insert ON public.groups;
DROP TRIGGER IF EXISTS groups_before_insertk ON public.groups;
DROP TRIGGER IF EXISTS groups_enforce_limit ON public.groups;
DROP TRIGGER IF EXISTS groups_after_insert ON public.groups;
DROP TRIGGER IF EXISTS trg_handle_new_group ON public.groups;
DROP TRIGGER IF EXISTS trg_enforce_free_plan_group_limit ON public.groups;
DROP TRIGGER IF EXISTS trg_add_owner_as_member ON public.groups;

CREATE TRIGGER trg_handle_new_group
BEFORE INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_group();

CREATE TRIGGER trg_enforce_free_plan_group_limit
BEFORE INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_group_limit();

CREATE TRIGGER trg_add_owner_as_member
AFTER INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_as_member();