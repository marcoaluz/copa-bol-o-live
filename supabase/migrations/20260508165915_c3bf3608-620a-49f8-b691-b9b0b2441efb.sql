
-- Novo tipo de transação para devolução de saque rejeitado
ALTER TYPE tipo_transacao ADD VALUE IF NOT EXISTS 'devolucao_saque';
