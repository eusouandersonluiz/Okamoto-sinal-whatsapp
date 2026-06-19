-- Tasks created from a contact ficha could only carry a title + optional due
-- date. Adding a free-text note lets users capture follow-up context (e.g.
-- "lembrar de mandar a proposta atualizada") alongside the task. Nullable so
-- existing rows stay valid; idempotent for re-runs.

alter table tasks add column if not exists note text;
