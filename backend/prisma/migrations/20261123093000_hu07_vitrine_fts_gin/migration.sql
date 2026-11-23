-- HU-07 (T-VIT-01): Índice GIN para Busca Textual Full-Text Search (FTS) em português
-- sobre título e descrição das peças, além de índices compostos para filtragem rápida
-- por status, tipologia e polo cultural (< 400ms no Cenário 1 e relevância GIN no Cenário 2).

CREATE INDEX IF NOT EXISTS "pecas_fts_titulo_descricao_gin_idx"
ON "pecas"
USING GIN (to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("descricao", '')));

CREATE INDEX IF NOT EXISTS "pecas_status_tipologia_idx"
ON "pecas" ("status", "tipologia");

CREATE INDEX IF NOT EXISTS "atelies_polo_cultural_idx"
ON "atelies" ("polo_cultural");

