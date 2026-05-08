
-- Adiciona tipo de transação "bonus" para créditos virtuais (modelo legal: moedas sem valor monetário)
ALTER TYPE tipo_transacao ADD VALUE IF NOT EXISTS 'bonus';
