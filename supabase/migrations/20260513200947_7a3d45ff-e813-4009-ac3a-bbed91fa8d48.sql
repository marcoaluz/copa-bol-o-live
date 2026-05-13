-- Limpa profiles órfãos de execuções de teste anteriores
DELETE FROM public.profiles WHERE apelido LIKE 'tst%';