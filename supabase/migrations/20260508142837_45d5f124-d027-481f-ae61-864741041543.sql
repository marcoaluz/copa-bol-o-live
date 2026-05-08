
CREATE OR REPLACE FUNCTION public.agora_servidor()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT now();
$$;

REVOKE EXECUTE ON FUNCTION public.criar_ou_alterar_aposta(uuid, public.palpite_aposta, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.agora_servidor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agora_servidor() TO authenticated;
