
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- GROUPS
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- GROUP_MEMBERS
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ITEMS
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  category TEXT NOT NULL DEFAULT 'Outros',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','purchased')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchased_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_items_group ON public.items(group_id, status, created_at DESC);
CREATE INDEX idx_members_user ON public.group_members(user_id);

-- SECURITY DEFINER helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with(_other_user UUID, _me UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members a
    JOIN public.group_members b ON a.group_id = b.group_id
    WHERE a.user_id = _me AND b.user_id = _other_user
  );
$$;

-- PROFILES policies
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_group_with(id, auth.uid()));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- GROUPS policies
CREATE POLICY "members view groups" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()));
CREATE POLICY "create groups" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update groups" ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner delete groups" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- GROUP_MEMBERS policies
CREATE POLICY "view memberships of my groups" ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));
CREATE POLICY "insert own membership" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "leave group" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ITEMS policies
CREATE POLICY "members view items" ON public.items FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members insert items" ON public.items FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "members update items" ON public.items FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members delete items" ON public.items FOR DELETE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Join by invite code (enforces free plan member limit)
CREATE OR REPLACE FUNCTION public.join_group_by_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _group_id UUID;
  _owner UUID;
  _owner_plan TEXT;
  _count INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id, owner_id INTO _group_id, _owner FROM public.groups WHERE invite_code = upper(_code);
  IF _group_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;

  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid()) THEN
    RETURN _group_id;
  END IF;

  SELECT plan INTO _owner_plan FROM public.profiles WHERE id = _owner;
  SELECT count(*) INTO _count FROM public.group_members WHERE group_id = _group_id;
  IF COALESCE(_owner_plan,'free') = 'free' AND _count >= 3 THEN
    RAISE EXCEPTION 'free_plan_member_limit';
  END IF;

  INSERT INTO public.group_members (group_id, user_id) VALUES (_group_id, auth.uid());
  RETURN _group_id;
END; $$;

-- Auto-add owner as member + generate invite code
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  ELSE
    NEW.invite_code := upper(NEW.invite_code);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER groups_before_insert BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id) VALUES (NEW.id, NEW.owner_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER groups_after_insert AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- Free plan: max 1 group as owner
CREATE OR REPLACE FUNCTION public.enforce_free_plan_group_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _plan TEXT; _count INT;
BEGIN
  SELECT plan INTO _plan FROM public.profiles WHERE id = NEW.owner_id;
  IF COALESCE(_plan,'free') = 'free' THEN
    SELECT count(*) INTO _count FROM public.groups WHERE owner_id = NEW.owner_id;
    IF _count >= 1 THEN RAISE EXCEPTION 'free_plan_group_limit'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER groups_enforce_limit BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_group_limit();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
