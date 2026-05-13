
CREATE OR REPLACE FUNCTION public.set_torneio_id_from_partida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.torneio_id IS NULL THEN
    SELECT torneio_id INTO NEW.torneio_id FROM public.partidas WHERE id = NEW.partida_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apostas_set_torneio ON public.apostas;
CREATE TRIGGER apostas_set_torneio
  BEFORE INSERT ON public.apostas
  FOR EACH ROW EXECUTE FUNCTION public.set_torneio_id_from_partida();

DROP TRIGGER IF EXISTS apostas_placar_set_torneio ON public.apostas_placar;
CREATE TRIGGER apostas_placar_set_torneio
  BEFORE INSERT ON public.apostas_placar
  FOR EACH ROW EXECUTE FUNCTION public.set_torneio_id_from_partida();
