CREATE OR REPLACE FUNCTION public.validar_signup_allowlist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public AS $$
DECLARE v_autorizado boolean;
BEGIN
  IF NEW.email IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_autorizados 
      WHERE email = lower(NEW.email)
    ) INTO v_autorizado;
    
    IF NOT v_autorizado THEN
      RAISE EXCEPTION 'E-mail % não está autorizado neste bolão. Solicite acesso ao organizador.', NEW.email
        USING ERRCODE = '42501';
    END IF;
  END IF;
  
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validar_signup ON auth.users;
CREATE TRIGGER trg_validar_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.validar_signup_allowlist();