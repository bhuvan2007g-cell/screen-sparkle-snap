-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.account_type AS ENUM ('adopter','owner','organization');
CREATE TYPE public.pet_status AS ENUM ('available','pending','adopted','removed');
CREATE TYPE public.application_status AS ENUM ('pending','under_review','approved','rejected');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');
CREATE TYPE public.verification_status AS ENUM ('unverified','pending','verified','rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  city TEXT,
  role public.account_type NOT NULL DEFAULT 'adopter',
  suspended BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizations are public" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Owner manages own organization" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Owner updates own organization" ON public.organizations FOR UPDATE TO authenticated USING (auth.uid() = profile_id OR public.is_admin()) WITH CHECK (auth.uid() = profile_id OR public.is_admin());

-- PETS
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  age NUMERIC(4,1),
  gender TEXT,
  size TEXT,
  city TEXT,
  description TEXT,
  health_information TEXT,
  vaccination_status TEXT,
  neutered BOOLEAN NOT NULL DEFAULT false,
  adoption_requirements TEXT,
  status public.pet_status NOT NULL DEFAULT 'available',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;
GRANT SELECT ON public.pets TO anon;
GRANT ALL ON public.pets TO service_role;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pets_species ON public.pets(species);
CREATE INDEX idx_pets_breed ON public.pets(breed);
CREATE INDEX idx_pets_city ON public.pets(city);
CREATE INDEX idx_pets_status ON public.pets(status);
CREATE INDEX idx_pets_owner ON public.pets(owner_id);
CREATE INDEX idx_pets_created ON public.pets(created_at DESC);

CREATE OR REPLACE FUNCTION public.can_list_pets(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND suspended = false AND role IN ('owner','organization'));
$$;

CREATE POLICY "Pets are public" ON public.pets FOR SELECT USING (status <> 'removed' OR auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "Owners create pets" ON public.pets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND public.can_list_pets(auth.uid()));
CREATE POLICY "Owners update own pets" ON public.pets FOR UPDATE TO authenticated USING (auth.uid() = owner_id OR public.is_admin()) WITH CHECK (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "Owners delete own pets" ON public.pets FOR DELETE TO authenticated USING (auth.uid() = owner_id OR public.is_admin());

-- PET IMAGES
CREATE TABLE public.pet_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_images TO authenticated;
GRANT SELECT ON public.pet_images TO anon;
GRANT ALL ON public.pet_images TO service_role;
ALTER TABLE public.pet_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pet_images_pet ON public.pet_images(pet_id);

CREATE OR REPLACE FUNCTION public.owns_pet(_pet_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pets WHERE id = _pet_id AND owner_id = _user_id);
$$;

CREATE POLICY "Pet images are public" ON public.pet_images FOR SELECT USING (true);
CREATE POLICY "Owners add pet images" ON public.pet_images FOR INSERT TO authenticated WITH CHECK (public.owns_pet(pet_id, auth.uid()));
CREATE POLICY "Owners update pet images" ON public.pet_images FOR UPDATE TO authenticated USING (public.owns_pet(pet_id, auth.uid()) OR public.is_admin()) WITH CHECK (public.owns_pet(pet_id, auth.uid()) OR public.is_admin());
CREATE POLICY "Owners delete pet images" ON public.pet_images FOR DELETE TO authenticated USING (public.owns_pet(pet_id, auth.uid()) OR public.is_admin());

-- FAVORITES
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pet_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ADOPTION APPLICATIONS
CREATE TABLE public.adoption_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  adopter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  housing_type TEXT,
  has_other_pets BOOLEAN NOT NULL DEFAULT false,
  experience TEXT,
  phone TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.adoption_applications TO authenticated;
GRANT ALL ON public.adoption_applications TO service_role;
ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_apps_pet ON public.adoption_applications(pet_id);
CREATE INDEX idx_apps_adopter ON public.adoption_applications(adopter_id);
CREATE INDEX idx_apps_created ON public.adoption_applications(created_at DESC);
CREATE UNIQUE INDEX idx_apps_one_active ON public.adoption_applications(pet_id, adopter_id) WHERE status IN ('pending','under_review');

CREATE POLICY "Adopter or pet owner reads applications" ON public.adoption_applications FOR SELECT TO authenticated
  USING (auth.uid() = adopter_id OR public.owns_pet(pet_id, auth.uid()) OR public.is_admin());
CREATE POLICY "Adopter creates own application" ON public.adoption_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = adopter_id AND NOT public.owns_pet(pet_id, auth.uid()));
CREATE POLICY "Pet owner updates applications" ON public.adoption_applications FOR UPDATE TO authenticated
  USING (public.owns_pet(pet_id, auth.uid()) OR public.is_admin()) WITH CHECK (public.owns_pet(pet_id, auth.uid()) OR public.is_admin());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporter or admin reads reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.is_admin());
CREATE POLICY "Users create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins update reports" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TIMESTAMP TRIGGERS
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_pets_touch BEFORE UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_apps_touch BEFORE UPDATE ON public.adoption_applications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- NOTIFICATION TRIGGERS
CREATE OR REPLACE FUNCTION public.notify_owner_new_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner UUID; _pet TEXT; _adopter TEXT;
BEGIN
  SELECT owner_id, name INTO _owner, _pet FROM public.pets WHERE id = NEW.pet_id;
  SELECT full_name INTO _adopter FROM public.profiles WHERE id = NEW.adopter_id;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_owner, 'New adoption application',
    COALESCE(_adopter,'Someone') || ' applied to adopt ' || COALESCE(_pet,'your pet') || '.', 'application');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_new_application AFTER INSERT ON public.adoption_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_new_application();

CREATE OR REPLACE FUNCTION public.handle_application_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pet TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name INTO _pet FROM public.pets WHERE id = NEW.pet_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.adopter_id, 'Application ' || NEW.status::text,
      'Your application for ' || COALESCE(_pet,'a pet') || ' is now ' || replace(NEW.status::text,'_',' ') || '.', 'application');

    IF NEW.status = 'approved' THEN
      UPDATE public.pets SET status = 'adopted' WHERE id = NEW.pet_id;
      UPDATE public.adoption_applications SET status = 'rejected'
        WHERE pet_id = NEW.pet_id AND id <> NEW.id AND status IN ('pending','under_review');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_application_decision AFTER UPDATE ON public.adoption_applications
FOR EACH ROW EXECUTE FUNCTION public.handle_application_decision();

-- REALTIME
ALTER TABLE public.adoption_applications REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.pets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.adoption_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pets;