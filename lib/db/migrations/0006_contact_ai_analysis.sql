-- On-demand AI analysis ("fotografia da relação") persisted per contact, so the
-- text is generated once and cached instead of re-running the model on every
-- open of the ficha. Generation is gated to contacts with >10 messages to
-- control cost; regenerating overwrites in place.
--
-- ai_analysis           -> the pt-BR overview text (null = never generated)
-- ai_analysis_at        -> when it was last generated (for "gerada em ...")
-- ai_analysis_msg_count -> how many messages existed at generation time

alter table contacts add column if not exists ai_analysis text;
alter table contacts add column if not exists ai_analysis_at timestamptz;
alter table contacts add column if not exists ai_analysis_msg_count integer;
