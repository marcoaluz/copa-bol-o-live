DELETE FROM public.apostas WHERE usuario_id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
DELETE FROM public.apostas_placar WHERE usuario_id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
DELETE FROM public.transacoes WHERE usuario_id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
DELETE FROM public.notificacoes WHERE usuario_id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
DELETE FROM public.profiles WHERE apelido LIKE 'tst%';
DELETE FROM public.partidas WHERE codigo_partida LIKE 'TEST-%';
DELETE FROM public.selecoes WHERE codigo_iso ~ '^T[0-9][AB]$';