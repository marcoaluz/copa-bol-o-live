GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.email_esta_autorizado() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public._assert_autorizado() TO authenticated, anon;