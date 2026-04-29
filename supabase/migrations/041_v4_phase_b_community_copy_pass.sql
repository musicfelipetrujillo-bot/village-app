-- V4 Phase B — village_supports community-row copy rewrite
--
-- Migration 038 nulled cta_label + cta_target on the 8 `community:room:*`
-- rows (since the Connect tab is hidden by product decision and the rooms
-- feature doesn't ship). The 038 author flagged a follow-up: "Title/body
-- copy stays — a follow-up content pass can soften phrasing if it still
-- reads like a feature promise."
--
-- This is that pass. Seven of those eight rows still mention "the postpartum
-- room", "thread in the room", "stage filter in the room", "the 0–6 month
-- room", etc. — language that promises a feature surface that doesn't ship.
-- A postpartum reader on the discharge-handoff path tapping a card titled
-- "Drop into a postpartum room thread" with no tap target reads as broken,
-- not as informational. Rewrites here:
--   • drop every reference to "the postpartum room" / "stage filter" /
--     "thread in the room" / "0–6 month room"
--   • reframe each card as evergreen peer-connection guidance (call a
--     friend, ask a mom 1–2 weeks ahead, talk to your partner) — content
--     that stands on its own with NO CTA
--   • preserve clinical-handoff-grade tone (matches the rest of the seed)
--   • keep support_type as-is (peer/community type still reads correctly
--     as "wider community of moms", not the in-app Community feature)
--
-- The eighth row (week 7 — "A 10-minute partner check-in") is left alone
-- — its body is about partner check-ins, not rooms. Migration 038 already
-- nulled its bait-and-switch CTA; the prose itself is fine as-is.
--
-- Match strategy: WHERE body = '<exact original>' so re-runs are no-ops
-- and any prior Supabase Studio edits to the rows aren't overwritten.

BEGIN;

-- ─── Week 1 — "You are not the first to feel this" ─────────────────────
UPDATE village_supports
SET title = 'You are not the first to feel this',
    body  = 'Whatever you are feeling at 3 a.m. tonight — exhausted, weepy, suddenly furious — another mom felt it last night somewhere. You are inside a centuries-deep cohort of women who have done this before. None of what you are feeling makes you broken or alone. If a friend or family member has been through postpartum recently, calling her this week is worth more than any article.'
WHERE week_number = 1
  AND support_type = 'community'
  AND body = 'The postpartum room in the Village is full of moms in week 1, 2, 3. Reading what someone wrote at 3 a.m. last night can be enough to make this hour bearable.';

UPDATE village_supports_i18n vsi
SET title = 'No eres la primera en sentir esto',
    body  = 'Lo que sea que estés sintiendo a las 3 de la mañana esta noche — agotada, llorosa, repentinamente furiosa — otra mamá lo sintió anoche en algún lado. Estás dentro de una larga corriente de mujeres que ya pasó por esto. Nada de lo que sientes te hace estar rota ni sola. Si una amiga o familiar pasó por el posparto hace poco, llamarla esta semana vale más que cualquier artículo.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 1
  AND vs.support_type = 'community'
  AND vsi.locale = 'es'
  AND vsi.body = 'La sala de posparto en The Village está llena de mamás en la semana 1, 2, 3. Leer lo que alguien escribió a las 3 de la mañana anoche puede ser suficiente para hacer que esta hora sea más llevadera.';

-- ─── Week 4 — "Other moms at week four" (was: "Drop into a postpartum room thread") ─
UPDATE village_supports
SET title = 'Other moms at week four',
    body  = 'At week four, the small wins matter — the burp cloth that finally works, the diaper brand that stopped leaking, the playlist your baby calms to. Borrowing what has worked for another mom is faster than figuring all of it out on your own. If you know a mom one to three months ahead of you, ask her what surprised her about week four. Her answer is the shortcut.'
WHERE week_number = 4
  AND support_type = 'community'
  AND body = 'Reading what someone wrote at week four — frustrations, small wins, the one thing that finally made bath time bearable — is a faster shortcut to perspective than any book.';

UPDATE village_supports_i18n vsi
SET title = 'Otras mamás en la semana cuatro',
    body  = 'A las cuatro semanas, las pequeñas victorias importan — la mantita para los eructos que por fin funciona, la marca de pañales que dejó de fugarse, la lista de canciones con la que tu bebé se calma. Tomar prestado lo que le funcionó a otra mamá es más rápido que descubrirlo todo sola. Si conoces a una mamá que va de uno a tres meses adelante, pregúntale qué la sorprendió de la semana cuatro. Su respuesta es el atajo.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 4
  AND vs.support_type = 'community'
  AND vsi.locale = 'es'
  AND vsi.body = 'Leer lo que alguien escribió en la semana cuatro — frustraciones, pequeñas victorias, eso que por fin hizo que la hora del baño fuera llevadera — es un atajo más rápido a la perspectiva que cualquier libro.';

-- ─── Week 5 — "Find a mom at the same week" (support_type = 'peer') ─────
UPDATE village_supports
SET title = 'Find a mom at the same week',
    body  = 'Loneliness flattens fastest when you talk to someone in the same fog — same week, same questions, same 4 a.m. exhaustion. A friend, a sister, a cousin, a neighbor with a baby roughly your baby''s age — even one short conversation a week helps. If your circle is thin, a postpartum support group at a local hospital or a peer-support line is a real substitute.'
WHERE week_number = 5
  AND support_type = 'peer'
  AND body = 'Reading or chatting with someone in week five — same fog, same questions — flattens the loneliness fastest. The stage filter in the postpartum room surfaces them.';

UPDATE village_supports_i18n vsi
SET title = 'Encuentra a una mamá en la misma semana',
    body  = 'La soledad se aplana más rápido cuando hablas con alguien que está en la misma neblina — misma semana, mismas preguntas, mismo agotamiento de las 4 de la mañana. Una amiga, una hermana, una prima, una vecina con un bebé más o menos de la edad del tuyo — basta con una conversación corta a la semana. Si tu círculo está delgado, un grupo de apoyo posparto en un hospital local o una línea de apoyo entre pares funciona como sustituto real.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 5
  AND vs.support_type = 'peer'
  AND vsi.locale = 'es'
  AND vsi.body = 'Leer o platicar con alguien en la semana cinco — misma neblina, mismas preguntas — aplana la soledad más rápido. El filtro por etapa en la sala de posparto te las muestra.';

-- ─── Week 8 — "Return-to-work logistics, mom to mom" (was: "A return-to-work room…") ─
UPDATE village_supports
SET title = 'Return-to-work logistics, mom to mom',
    body  = 'If you are heading back, the practical pieces — bottle refusal, pump schedules at work, daycare vs. nanny tradeoffs, the first sick day at care — are learned fastest from another mom one or two weeks ahead of you. Ask the moms in your life who went back recently; their playbook is more current than any article. HR may also have a quiet "back from leave" group worth joining.'
WHERE week_number = 8
  AND support_type = 'community'
  AND body = 'There''s a thread in the postpartum room specifically for return-to-work logistics: bottle refusal, pump schedules, daycare-vs-nanny pros and cons. Real moms, real schedules, no curated content.';

UPDATE village_supports_i18n vsi
SET title = 'Logística de vuelta al trabajo, de mamá a mamá',
    body  = 'Si vas a regresar al trabajo, las piezas prácticas — el rechazo del biberón, los horarios de extracción en el trabajo, guardería contra niñera, el primer día de enfermedad en el cuidado — se aprenden más rápido de otra mamá que esté una o dos semanas adelante. Pregúntale a las mamás en tu vida que volvieron hace poco; su manual es más vigente que cualquier artículo. Recursos Humanos puede tener un grupo discreto de "regreso de licencia" que vale la pena.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 8
  AND vs.support_type = 'community'
  AND vsi.locale = 'es'
  AND vsi.body = 'Hay un hilo en la sala de posparto específicamente para la logística de vuelta al trabajo: rechazo del biberón, horarios de extracción, ventajas y desventajas de guardería frente a niñera. Mamás reales, horarios reales, sin contenido curado.';

-- ─── Week 10 — "Find a mom one week ahead" (was: "What week are you in" thread) ──
UPDATE village_supports
SET title = 'Find a mom one week ahead',
    body  = 'Knowing what is about to happen — the next sleep shift, the next feeding change, the next emotional curveball — comes most clearly from a mom one or two weeks ahead. If your social circle has a mom slightly further along, ask her what was hardest about week 10. Her answer is your week 11 forecast.'
WHERE week_number = 10
  AND support_type = 'community'
  AND body = 'The postpartum room sorts by stage so you can find moms in week 9, 10, or 11. Reading the in-the-thick-of-it posts from people one week ahead is its own kind of orientation.';

UPDATE village_supports_i18n vsi
SET title = 'Encuentra a una mamá una semana adelante',
    body  = 'Saber lo que viene — el siguiente cambio de sueño, el siguiente ajuste de alimentación, el siguiente vaivén emocional — se entiende mejor con una mamá que va una o dos semanas adelante. Si en tu círculo hay una mamá un poco más adelantada, pregúntale qué fue lo más difícil de su semana 10. Su respuesta es tu pronóstico de la semana 11.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 10
  AND vs.support_type = 'community'
  AND vsi.locale = 'es'
  AND vsi.body = 'La sala de posparto se ordena por etapa, así que puedes encontrar mamás en la semana 9, 10 u 11. Leer las publicaciones en pleno frente de batalla de quien está una semana adelante es su propia forma de orientación.';

-- ─── Week 11 — "Honest stories about postpartum intimacy" ─────────────
UPDATE village_supports
SET title = 'Honest stories about postpartum intimacy',
    body  = 'Postpartum intimacy doesn''t follow the timeline magazines suggest. The 6-week clearance is medical permission to start, not a starting gun. Many couples take 3–6 months to feel settled; some longer. Pain, dryness, low desire, body unfamiliarity — all common, all usually temporary, none a verdict on the relationship. Talking to one mom you trust often loosens the shame faster than any article. If pain persists past clearance, pelvic floor PT helps.'
WHERE week_number = 11
  AND support_type = 'community'
  AND body = 'The intimacy thread in the postpartum room is plain-spoken, not performative. Real timelines, real friction, real workarounds — useful when nothing else is.';

UPDATE village_supports_i18n vsi
SET title = 'Historias honestas sobre la intimidad posparto',
    body  = 'La intimidad posparto no sigue el calendario que sugieren las revistas. La autorización de las 6 semanas es permiso médico para empezar, no la línea de salida. Muchas parejas tardan de 3 a 6 meses en sentirse cómodas; algunas más. Dolor, sequedad, poco deseo, no reconocer el cuerpo — todo común, casi siempre temporal, nada es un veredicto sobre la relación. Hablar con una mamá de confianza suele aflojar la vergüenza más rápido que cualquier artículo. Si el dolor persiste después de la autorización médica, la fisio de piso pélvico ayuda.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 11
  AND vs.support_type = 'community'
  AND vsi.locale = 'es'
  AND vsi.body = 'El hilo de intimidad en la sala de posparto es directo, no performativo. Tiempos reales, fricciones reales, soluciones reales — útil cuando nada más lo es.';

-- ─── Week 12 — "What changes after week 12" (was: "0–6 month room ahead of the transition") ─
UPDATE village_supports
SET title = 'What changes after week 12',
    body  = 'As you cross 12 weeks, the questions shift. Solids start landing on the radar between week 16 and 24. The 4-month sleep regression is real and resolves. Daycare onboarding has its own learning curve. The first cold and the first fever are both around the corner. Reading about each one a week or two ahead beats arriving cold — the milestone library in this app covers each in turn.'
WHERE week_number = 12
  AND support_type = 'community'
  AND body = 'As you cross 12 weeks, the conversations shift. The 0–6 month room covers introducing solids, the 4-month sleep change, daycare onboarding, and the first round of meaningful illnesses. Easing in now beats arriving cold at week 16.';

UPDATE village_supports_i18n vsi
SET title = 'Qué cambia después de la semana 12',
    body  = 'Al cruzar las 12 semanas, las preguntas cambian. Los sólidos empiezan a aparecer en el radar entre la semana 16 y la 24. La regresión del sueño de los 4 meses es real y se resuelve. La entrada a guardería tiene su propia curva de aprendizaje. El primer catarro y la primera fiebre están a la vuelta. Leer sobre cada cosa con una o dos semanas de anticipación es mejor que llegar en frío — la biblioteca de hitos de esta app cubre cada uno a su tiempo.'
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.week_number = 12
  AND vs.support_type = 'community'
  AND vsi.locale = 'es'
  AND vsi.body = 'Al cruzar las 12 semanas, las conversaciones cambian. La sala de 0 a 6 meses habla de introducir sólidos, el cambio de sueño de los 4 meses, la entrada a guardería y los primeros catarros importantes. Ir entrando ahora es mejor que llegar fría en la semana 16.';

COMMIT;

-- Sanity check: no village_supports row should still reference "postpartum
-- room" / "stage filter" / "0–6 month room" in body. RAISE EXCEPTION rather
-- than NOTICE so a regression in a future seed migration fails the reset.
DO $$
DECLARE
  leak_count INT;
BEGIN
  SELECT COUNT(*) INTO leak_count
  FROM village_supports
  WHERE body ILIKE '%postpartum room%'
     OR body ILIKE '%stage filter in the postpartum%'
     OR body ILIKE '%0-6 month room%'
     OR body ILIKE '%0–6 month room%';
  IF leak_count > 0 THEN
    RAISE EXCEPTION 'village_supports still has % rows referencing the rooms feature after migration 041', leak_count;
  END IF;

  SELECT COUNT(*) INTO leak_count
  FROM village_supports_i18n
  WHERE body ILIKE '%sala de posparto%'
     OR body ILIKE '%hilo en la sala%'
     OR body ILIKE '%filtro por etapa%'
     OR body ILIKE '%sala de 0 a 6 meses%';
  IF leak_count > 0 THEN
    RAISE EXCEPTION 'village_supports_i18n still has % ES rows referencing the rooms feature after migration 041', leak_count;
  END IF;
END $$;
