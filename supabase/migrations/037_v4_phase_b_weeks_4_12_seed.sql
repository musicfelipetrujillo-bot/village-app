-- V4 Phase B — Weekly Journey: weeks 4–12 seed (postpartum core continuation).
-- Migration 036 shipped the schema + weeks 1–3. This migration completes the
-- postpartum 0–12 week window per the hospital-discharge GTM (the primary
-- content target).
--
-- Same convention as 036:
--   • Per week: 3 maternal_insights + 2 village_supports + 4 week_checklists
--   • EN canonical on parent rows; ES on the i18n side-tables
--   • Marked review_status='approved' / clinical_advisor_reviewed=FALSE
--     so a licensed clinical advisor can dashboard via
--     idx_maternal_insights_review_dashboard and flip the flag in batch.
--   • requires_crisis_footer=TRUE only on bodies that touch PPD,
--     suicidality, or where a tired user might read encouragement as
--     deflection (week 6 emotional + week 8 emotional).
--   • week_checklists `is_essential=TRUE` only on items that are clinical
--     red flags — chiefly the 6-week postpartum visit (week 6 medical row).

-- ─── Week 4 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    4, 'recovery',
    'A month in — and still healing',
    'You made it through the first month. Most external bleeding has tapered, though spotting can come and go for several more weeks. Your incision (if you had a cesarean) is closing on the surface; the deeper tissue takes much longer. If you''re seeing a sudden return of bright red bleeding, foul-smelling discharge, or pain that is sharper than yesterday''s — those are calls to your provider, not Google.',
    '🌿', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Un mes después — y aún sanando',
  'Lograste pasar el primer mes. La mayor parte del sangrado externo ya disminuyó, aunque el manchado puede ir y venir por varias semanas más. Tu incisión (si tuviste cesárea) está cerrándose por fuera; el tejido profundo tarda mucho más. Si aparece de pronto sangrado rojo vivo, flujo con mal olor o un dolor más agudo que el de ayer — esas son llamadas a tu proveedora, no a Google.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    4, 'sleep',
    'The first slightly longer stretch',
    'Around four weeks, some babies start consolidating one nighttime stretch into 4–5 hours. Some don''t. Both are normal. Yours might give you a 4-hour gift one night and revert to 90-minute wakings the next — that volatility is biology, not regression. Protect the longest stretch you can: go to bed when the baby goes to bed for the night.',
    '🌙', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'El primer bloque un poco más largo',
  'Alrededor de las cuatro semanas, algunos bebés empiezan a consolidar un bloque nocturno de 4 a 5 horas. Otros no. Las dos cosas son normales. El tuyo puede regalarte una noche con 4 horas y volver a despertarse cada 90 minutos la siguiente — esa volatilidad es biología, no retroceso. Protege el bloque más largo que puedas: vete a dormir cuando el bebé se acueste por la noche.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    4, 'feeding',
    'Patterns are forming, but loosely',
    'By week four, you may notice rough rhythms — eat, awake window, sleep, repeat. Don''t mistake patterns for schedules; the baby is not on a clock yet. Watch hunger cues (rooting, hands to mouth, fussy → cry as a late sign) more than the wall clock. Wet diapers and weight gain are still your two best data points; everything else is noise.',
    '🍼', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Se están formando patrones, pero sueltos',
  'Para la semana cuatro, puede que notes ritmos más o menos definidos — comer, ventana despierto, dormir, repetir. No confundas patrones con horarios; el bebé todavía no está en un reloj. Observa las señales de hambre (buscar el pecho, manos a la boca, inquietud → el llanto es señal tardía) más que la hora en la pared. Los pañales mojados y la ganancia de peso siguen siendo tus dos mejores datos; todo lo demás es ruido.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    4, 'expert',
    'Pre-book your 6-week postpartum visit',
    'Most providers want to see you between weeks 4 and 6. Book it now if you haven''t — calendars fill up, and you don''t want to push a clinical visit into week 8 because the slots are gone.',
    '🩺', 'Find an OB/midwife', 'experts:home:obgyn',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Agenda tu visita posparto de las 6 semanas',
  'La mayoría de las proveedoras quieren verte entre la semana 4 y la 6. Si todavía no la agendaste, hazlo ahora — los calendarios se llenan y no quieres terminar empujando una visita clínica a la semana 8.',
  'Buscar OB/partera'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    4, 'community',
    'Drop into a postpartum room thread',
    'Reading what someone wrote at week four — frustrations, small wins, the one thing that finally made bath time bearable — is a faster shortcut to perspective than any book.',
    '💬', 'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Pásate por un hilo de la sala de posparto',
  'Leer lo que alguien escribió en la semana cuatro — frustraciones, pequeñas victorias, eso que por fin hizo que la hora del baño fuera llevadera — es un atajo más rápido a la perspectiva que cualquier libro.',
  'Abrir sala de posparto'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (4, 'medical',   'Confirm your 6-week postpartum visit is scheduled. Add the date to your phone calendar today.', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (4, 'practical', 'Restock the feeding station — diapers, wipes, snacks, water — so you''re not running out at 2 a.m.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (4, 'emotional', 'Notice one thing this week that''s easier than it was at week one. Tell yourself out loud.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (4, 'household', 'If you have help offered, accept it for one specific task this week — even an hour counts.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (4, 'medical',   'Confirm your 6-week postpartum visit is scheduled. Add the date to your phone calendar today.', 'Confirma que tu visita posparto de las 6 semanas esté agendada. Agrega la fecha al calendario de tu teléfono hoy.'),
  (4, 'practical', 'Restock the feeding station — diapers, wipes, snacks, water — so you''re not running out at 2 a.m.', 'Reabastece la estación de alimentación — pañales, toallitas, snacks, agua — para que no te quedes sin nada a las 2 de la mañana.'),
  (4, 'emotional', 'Notice one thing this week that''s easier than it was at week one. Tell yourself out loud.', 'Nota una cosa esta semana que sea más fácil que en la semana uno. Dítelo a ti misma en voz alta.'),
  (4, 'household', 'If you have help offered, accept it for one specific task this week — even an hour counts.', 'Si te ofrecen ayuda, acéptala para una tarea concreta esta semana — aunque sea una hora, cuenta.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 5 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    5, 'emotional',
    'The fog around the edges',
    'Week five often lands in a strange middle: the early shock has faded, but the fatigue has compounded. You may feel scrambled — forgetting words, walking into rooms with no plan, crying at small kindnesses. That is a tired brain, not a broken one. Sleep deprivation rearranges memory and mood; it doesn''t mean something is wrong with you.',
    '🌫️', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'La neblina en los bordes',
  'La semana cinco suele caer en un punto intermedio extraño: el shock inicial ya se desvaneció, pero el cansancio se ha ido sumando. Puede que te sientas desordenada — olvidando palabras, entrando a un cuarto sin saber a qué, llorando con pequeños gestos amables. Eso es un cerebro cansado, no un cerebro roto. La privación de sueño reorganiza la memoria y el ánimo; no significa que haya algo mal contigo.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    5, 'identity',
    'The version of you from before',
    'You may catch glimpses of pre-baby you in the mirror this week — and they may feel both familiar and far away. There is no rush to become her again. Postpartum identity isn''t a return; it''s a re-formation. The hobbies, friendships, and rhythms that made up the old you don''t disappear — they''ll come back in a different shape, on a slower clock.',
    '🪞', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'La versión de ti de antes',
  'Esta semana puede que veas vislumbres en el espejo de la tú de antes del bebé — y se sientan al mismo tiempo familiares y lejanas. No hay prisa por volver a ser ella. La identidad posparto no es un regreso; es una nueva formación. Los pasatiempos, las amistades y los ritmos que componían tu vida anterior no desaparecen — van a volver con otra forma, en un tiempo más lento.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    5, 'sleep',
    'Your sleep, not just the baby''s',
    'You''ve heard a thousand times to sleep when the baby sleeps. The harder version is to also let yourself sleep when the baby is held by someone else. If a partner or family member can take a 2-hour block, use it for sleep, not laundry. Quality matters more than total hours right now — one uninterrupted 2-hour block can reset more than four broken hours of rest.',
    '😴', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Tu sueño, no solo el del bebé',
  'Has oído mil veces que duermas cuando el bebé duerma. La versión más difícil es además permitirte dormir cuando alguien más está cargando al bebé. Si tu pareja o un familiar puede tomarse un bloque de 2 horas, úsalo para dormir, no para la lavandería. La calidad importa más que el total de horas ahora mismo — un bloque ininterrumpido de 2 horas puede reiniciarte más que cuatro horas de descanso roto.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    5, 'peer',
    'Find a mom at the same week',
    'Reading or chatting with someone in week five — same fog, same questions — flattens the loneliness fastest. The stage filter in the postpartum room surfaces them.',
    '🫶', 'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Encuentra a una mamá en la misma semana',
  'Leer o platicar con alguien en la semana cinco — misma neblina, mismas preguntas — aplana la soledad más rápido. El filtro por etapa en la sala de posparto te las muestra.',
  'Abrir sala de posparto'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    5, 'professional',
    'A short call with a postpartum therapist',
    'Therapy at week five is not "for crisis only." A single 50-minute call can move things from a tangle to a list. Many therapists offer postpartum-focused intake visits.',
    '🌷', 'Find a PPD therapist', 'experts:home:ppd_therapy',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una llamada corta con una terapeuta posparto',
  'La terapia en la semana cinco no es "solo para crisis". Una sola llamada de 50 minutos puede convertir un nudo en una lista. Muchas terapeutas ofrecen visitas de admisión enfocadas en posparto.',
  'Buscar terapeuta de posparto'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (5, 'medical',   'Track your mood for 5 days — a 0–10 number each evening. Bring the trend to your 6-week visit.', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (5, 'practical', 'Pre-prep one freezer-friendly meal — soup, casserole, rice bowls. Future-you will thank you.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (5, 'emotional', 'Write one sentence about how you''re actually doing today. Just for you, no audience.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (5, 'household', 'Lower the bar this week. If the floor is sticky and the baby is fed, you''re winning.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (5, 'medical',   'Track your mood for 5 days — a 0–10 number each evening. Bring the trend to your 6-week visit.', 'Lleva un registro de tu estado de ánimo durante 5 días — un número del 0 al 10 cada noche. Lleva la tendencia a tu visita de las 6 semanas.'),
  (5, 'practical', 'Pre-prep one freezer-friendly meal — soup, casserole, rice bowls. Future-you will thank you.', 'Prepara una comida apta para congelador — sopa, cazuela, bowls de arroz. La tú del futuro te lo va a agradecer.'),
  (5, 'emotional', 'Write one sentence about how you''re actually doing today. Just for you, no audience.', 'Escribe una sola oración sobre cómo estás de verdad hoy. Solo para ti, sin público.'),
  (5, 'household', 'Lower the bar this week. If the floor is sticky and the baby is fed, you''re winning.', 'Baja la vara esta semana. Si el piso está pegajoso y el bebé está alimentado, vas ganando.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 6 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    6, 'recovery',
    'The 6-week visit is more than a checkbox',
    'This visit is the first time a clinician sees you as a postpartum patient, not a pregnant one. They''ll examine your incision or perineum, check on bleeding, ask about mood, and clear (or not clear) you for exercise and intercourse. Bring questions written down; the visit is short and the brain fog is real. If something has felt off, this is the moment to say it out loud.',
    '🩺', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'La visita de las 6 semanas es más que un trámite',
  'Esta visita es la primera vez que una clínica te ve como paciente posparto, no embarazada. Va a revisar tu incisión o periné, verificar el sangrado, preguntar por tu ánimo y autorizarte (o no) para ejercicio y relaciones sexuales. Lleva tus preguntas escritas; la visita es corta y la neblina mental es real. Si algo se ha sentido raro, este es el momento de decirlo en voz alta.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    6, 'feeding',
    'A different kind of supply question',
    'By week six, your body has largely calibrated to the baby''s needs. Worries about supply usually peak now — partly because feeds are shorter and breasts feel softer. That is your body becoming efficient, not failing. Trust the wet diapers and the weight checks. If you''re combo or formula feeding, the same logic holds: the baby tells you what enough looks like.',
    '🌾', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Otra forma de la pregunta sobre la producción',
  'Para la semana seis, tu cuerpo ya se calibró en gran parte a las necesidades del bebé. Las preocupaciones sobre la producción suelen llegar a su punto más alto ahora — en parte porque las tomas son más cortas y los pechos se sienten más blandos. Eso es que tu cuerpo se está volviendo eficiente, no que esté fallando. Confía en los pañales mojados y en las pesadas. Si das fórmula o combinas, la misma lógica aplica: el bebé te dice cómo se ve "suficiente".'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    6, 'emotional',
    'When the heaviness has not lifted',
    'If by week six the weight inside is still there — flat affect, intrusive thoughts, panic, rage, or a sense of disconnection from the baby — this is the moment to escalate. PPD and postpartum anxiety are most responsive to early treatment. They don''t resolve on their own with willpower. Your 6-week visit is the right venue to bring this up; if it can''t wait, the lines below are answered now.',
    '🌧️', TRUE, 'approved', FALSE,
    'Seed content — PPD-explicit; crisis footer required; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Cuando la pesadez no se ha levantado',
  'Si para la semana seis el peso por dentro sigue ahí — afecto plano, pensamientos intrusivos, pánico, rabia o una sensación de desconexión con el bebé — este es el momento de escalar. La depresión y la ansiedad posparto responden mejor a tratamiento temprano. No se resuelven solas con fuerza de voluntad. Tu visita de las 6 semanas es el lugar correcto para sacar el tema; si no puede esperar, las líneas de abajo responden ahora.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    6, 'expert',
    'Pelvic floor PT — earlier than you think',
    'Many providers clear pelvic floor PT around week six. It is standard postpartum care in much of Europe; in the US it''s under-prescribed. If you have leaking, pelvic heaviness, or pain with sex once cleared, ask for a referral.',
    '🌸', 'Find a pelvic floor PT', 'experts:home:pelvic_floor',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Fisioterapia de piso pélvico — antes de lo que piensas',
  'Muchas proveedoras autorizan la fisioterapia de piso pélvico alrededor de la semana seis. Es atención posparto estándar en gran parte de Europa; en EE. UU. se receta poco. Si tienes pérdidas de orina, pesadez pélvica o dolor con relaciones cuando ya estés autorizada, pide la derivación.',
  'Buscar fisio de piso pélvico'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    6, 'community',
    'A weekly check-in keeps the trend visible',
    'Filling in the daily check-in this week — even just twice — gives you a chart your future self (and your provider) can read. Patterns across days reveal what a single bad afternoon hides.',
    '📓', 'Open today''s check-in', 'home:DailyCheckin',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Un chequeo semanal mantiene visible la tendencia',
  'Llenar el chequeo diario esta semana — aunque sea dos veces — te da una gráfica que tu yo del futuro (y tu proveedora) pueden leer. Los patrones a lo largo de los días revelan lo que una sola tarde mala oculta.',
  'Abrir el chequeo de hoy'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (6, 'medical',   'Attend your 6-week postpartum visit. Bring questions written down — fog is real.', TRUE, 10, 'approved', FALSE, 'Seed content — clinical-essential checkpoint; clinical advisor review pending'),
  (6, 'medical',   'Ask about mental health screening (EPDS) at the visit if it isn''t offered.', FALSE, 11, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (6, 'practical', 'Refill any postpartum prescriptions before they run out.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (6, 'household', 'Re-set one room — the bedroom or the living room — back toward calm. Just one.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (6, 'medical', 'Attend your 6-week postpartum visit. Bring questions written down — fog is real.', 'Asiste a tu visita posparto de las 6 semanas. Lleva tus preguntas escritas — la neblina es real.'),
  (6, 'medical', 'Ask about mental health screening (EPDS) at the visit if it isn''t offered.', 'Pregunta por el tamizaje de salud mental (EPDS) en la visita si no te lo ofrecen.'),
  (6, 'practical', 'Refill any postpartum prescriptions before they run out.', 'Pide la receta nueva de cualquier medicamento posparto antes de que se te termine.'),
  (6, 'household', 'Re-set one room — the bedroom or the living room — back toward calm. Just one.', 'Reordena un cuarto — el dormitorio o la sala — hacia la calma. Solo uno.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 7 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    7, 'relationships',
    'You and your partner are running on different clocks',
    'If you have a partner, week seven is often when small resentments start to surface. They went back to work. You''re tracking sleep in 90-minute increments. The math of who is doing what feels uneven because it is. The fix is not a fair-share spreadsheet — it''s a 10-minute conversation, weekly, where neither of you is holding the baby.',
    '🤝', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Tu pareja y tú están en relojes distintos',
  'Si tienes pareja, la semana siete suele ser cuando empiezan a salir los pequeños resentimientos. Tu pareja volvió al trabajo. Tú llevas el sueño en bloques de 90 minutos. La cuenta de quién hace qué se siente desigual porque lo es. El arreglo no es una hoja de cálculo de tareas — es una conversación de 10 minutos, semanal, en la que ninguno de los dos esté cargando al bebé.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    7, 'feeding',
    'Bottles, pumps, and the politics of "topping off"',
    'Pumping rhythms, return-to-work logistics, and the anxiety about whether the baby will take a bottle from someone else can converge this week. There''s no one right answer. If you''re combo-feeding, you''re feeding the baby. If you''re exclusively breastfeeding and a single bottle a day brings you sanity, that is feeding the baby too.',
    '🍶', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Biberones, extractores y la política de "dar un poquito más"',
  'Los ritmos de extracción, la logística de la vuelta al trabajo y la ansiedad de si el bebé va a aceptar el biberón de alguien más pueden juntarse esta semana. No hay una sola respuesta correcta. Si combinas, estás alimentando al bebé. Si das pecho exclusivo y un solo biberón al día te da sanidad mental, eso también es alimentar al bebé.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    7, 'sleep',
    'Naps consolidate, slowly',
    'Around now you may notice naps starting to fall into rougher windows — a longer morning nap, a midday one, and a short late-afternoon nap. Don''t chase a schedule yet. Watch sleepy cues (yawns, ear-pulling, the second-wind escalation) and respond inside a 60–90 minute awake window. Pattern, not clock.',
    '☁️', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Las siestas se consolidan, despacio',
  'Por ahora puede que notes que las siestas empiezan a caer en ventanas un poco más definidas — una siesta más larga en la mañana, una al mediodía y una corta al final de la tarde. Todavía no busques un horario. Observa las señales de sueño (bostezos, jalarse la oreja, el segundo aire) y responde dentro de una ventana despierta de 60 a 90 minutos. Patrón, no reloj.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    7, 'expert',
    'A second look from lactation, if pumping',
    'If you''re pumping for return-to-work, an early lactation tune-up — flange size, schedule, output expectations — saves weeks of underperformance. Most plans cover at least one consult.',
    '🤱', 'Find a lactation consultant', 'experts:home:lactation',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una segunda mirada de lactancia, si extraes',
  'Si estás extrayendo leche para la vuelta al trabajo, un ajuste temprano con la consultora de lactancia — talla del embudo, horario, expectativas de producción — te ahorra semanas de bajo rendimiento. La mayoría de los seguros cubre al menos una consulta.',
  'Buscar consultora de lactancia'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    7, 'community',
    'A 10-minute partner check-in',
    'Set a recurring 10-minute slot with your partner this week. Not date night. Not logistics. Just: how are we, in one sentence each. Repeat weekly through year one.',
    '💞', 'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Un chequeo de 10 minutos con tu pareja',
  'Aparta un espacio recurrente de 10 minutos con tu pareja esta semana. No es cita. No es logística. Solo: ¿cómo estamos? — una oración cada quien. Repítelo cada semana durante todo el primer año.',
  'Abrir sala de posparto'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (7, 'medical',   'If pumping for return-to-work, plan one lactation tune-up before week 10.', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (7, 'practical', 'Inventory your bottles, pump parts, and storage bags. Replace anything cracked or stained.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (7, 'emotional', 'Have one 10-minute, baby-not-in-arms conversation with your partner this week.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (7, 'household', 'Identify one task your partner can fully own — not "help with," but own.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (7, 'medical', 'If pumping for return-to-work, plan one lactation tune-up before week 10.', 'Si vas a extraer leche para la vuelta al trabajo, planea un ajuste con la consultora de lactancia antes de la semana 10.'),
  (7, 'practical', 'Inventory your bottles, pump parts, and storage bags. Replace anything cracked or stained.', 'Revisa tus biberones, partes del extractor y bolsas de almacenamiento. Reemplaza lo que esté agrietado o manchado.'),
  (7, 'emotional', 'Have one 10-minute, baby-not-in-arms conversation with your partner this week.', 'Ten una conversación de 10 minutos con tu pareja esta semana, sin el bebé en brazos.'),
  (7, 'household', 'Identify one task your partner can fully own — not "help with," but own.', 'Identifica una tarea que tu pareja pueda asumir por completo — no "ayudar con", sino hacer suya.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 8 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    8, 'emotional',
    'Two months in — taking your own temperature',
    'By week eight, the easy explanation of "this is just the newborn fog" starts to wear thin. If you''re still finding it hard to feel anything when you look at your baby, hard to imagine joy returning, hard to picture a future you want to be in — that is a clinical signal, not a personality trait. Postpartum mood disorders affect 1 in 7 mothers. Asking for treatment is the same kind of decision as setting a broken bone.',
    '🌗', TRUE, 'approved', FALSE,
    'Seed content — PPD-explicit; crisis footer required; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Dos meses dentro — tomándote tu propio pulso',
  'Para la semana ocho, la explicación fácil de "es solo la neblina del recién nacido" empieza a quedarse corta. Si todavía te cuesta sentir algo cuando miras a tu bebé, te cuesta imaginar que vuelva la alegría, te cuesta verte en un futuro en el que quieras estar — esa es una señal clínica, no un rasgo de personalidad. Los trastornos de ánimo posparto afectan a 1 de cada 7 madres. Pedir tratamiento es del mismo tipo de decisión que enyesar un hueso roto.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    8, 'identity',
    'Returning to work — or not — and the prep that helps',
    'If you''re heading back to work in the coming weeks, the prep that pays off is small and specific: one bottle a day from someone else, a short trial separation while baby is awake, a pump session at the time of day you''ll actually be at work. If you''re not returning, the same prep helps you build a sustainable home rhythm. Either path is real work.',
    '🌅', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Volver al trabajo — o no — y el preparativo que ayuda',
  'Si vuelves al trabajo en las próximas semanas, los preparativos que rinden son pequeños y concretos: un biberón al día dado por otra persona, una corta separación de prueba con el bebé despierto, una sesión de extracción a la hora del día en que de verdad vas a estar en el trabajo. Si no vas a volver, los mismos preparativos te ayudan a construir un ritmo sostenible en casa. Cualquiera de los dos caminos es trabajo real.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    8, 'sleep',
    'A first taste of routine',
    'Many babies start showing the bones of a daytime routine around now — three rough naps, a long awake stretch in the evening before bed, and one slightly longer nighttime block. You may have a first night with a 5-hour stretch; you may not. If you do, don''t plan around it. Treat any extra sleep as a gift, not a guarantee.',
    '🌙', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Un primer sabor de rutina',
  'Muchos bebés empiezan a mostrar los huesos de una rutina de día por ahora — tres siestas más o menos definidas, un bloque despierto largo al final de la tarde antes de dormir, y un bloque nocturno un poco más largo. Puede que tengas una primera noche con 5 horas seguidas; o no. Si la tienes, no planees alrededor de eso. Trata cualquier sueño extra como un regalo, no como una garantía.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    8, 'professional',
    'A PPD therapist who takes new patients quickly',
    'If something has shifted in the last two weeks — heavier feelings, intrusive thoughts, less interest in things you used to enjoy — finding a therapist who can see you within 7–10 days matters. Many specialize in postpartum and have shorter waitlists.',
    '🌷', 'Find a PPD therapist', 'experts:home:ppd_therapy',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una terapeuta de PPD que reciba pacientes nuevas rápido',
  'Si algo cambió en las últimas dos semanas — sentimientos más pesados, pensamientos intrusivos, menos interés en cosas que antes disfrutabas — encontrar una terapeuta que te pueda ver en 7 a 10 días importa. Muchas se especializan en posparto y tienen listas de espera más cortas.',
  'Buscar terapeuta de PPD'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    8, 'community',
    'A return-to-work room, if you''re heading back',
    'There''s a thread in the postpartum room specifically for return-to-work logistics: bottle refusal, pump schedules, daycare-vs-nanny pros and cons. Real moms, real schedules, no curated content.',
    '🛍️', 'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Un hilo de vuelta al trabajo, si vas a volver',
  'Hay un hilo en la sala de posparto específicamente para la logística de vuelta al trabajo: rechazo del biberón, horarios de extracción, ventajas y desventajas de guardería frente a niñera. Mamás reales, horarios reales, sin contenido curado.',
  'Abrir sala de posparto'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (8, 'medical',   'If your mood has worsened in the last two weeks, call your provider today — don''t wait for the next visit.', FALSE, 10, 'approved', FALSE, 'Seed content — clinical-grade emotional triage; clinical advisor review pending'),
  (8, 'practical', 'If returning to work, do one bottle-feed handoff to someone else this week as a trial run.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (8, 'emotional', 'Identify one thing you used to enjoy and try a 5-minute version of it today.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (8, 'household', 'Pre-stage a "leaving the house" bag: diapers, change of clothes, snacks, water. Check it Sunday night.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (8, 'medical', 'If your mood has worsened in the last two weeks, call your provider today — don''t wait for the next visit.', 'Si tu ánimo empeoró en las últimas dos semanas, llama hoy a tu proveedora — no esperes a la próxima visita.'),
  (8, 'practical', 'If returning to work, do one bottle-feed handoff to someone else this week as a trial run.', 'Si vas a volver al trabajo, esta semana deja que otra persona dé un biberón como ensayo.'),
  (8, 'emotional', 'Identify one thing you used to enjoy and try a 5-minute version of it today.', 'Identifica algo que antes disfrutabas y prueba una versión de 5 minutos de eso hoy.'),
  (8, 'household', 'Pre-stage a "leaving the house" bag: diapers, change of clothes, snacks, water. Check it Sunday night.', 'Deja preparada una bolsa para "salir de casa": pañales, muda de ropa, snacks, agua. Revísala el domingo en la noche.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 9 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    9, 'feeding',
    'Cluster feeds ease, evening fussiness peaks',
    'You may notice the brutal evening cluster-feed marathons start to soften this week — replaced by a different evening shape: shorter feeds but heavier fussiness around dinner time. That late-day fussiness ("witching hour") peaks around now and tapers by month four. Skin-to-skin, dim lights, motion (a sling or a slow walk) help more than another feed often does.',
    '🍼', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Las tomas en racimo ceden, la inquietud nocturna llega a su pico',
  'Puede que esta semana los maratones brutales de tomas en racimo en la tarde-noche empiecen a suavizarse — y los reemplace otra forma del atardecer: tomas más cortas pero más inquietud cerca de la hora de la cena. Esa inquietud al final del día ("hora bruja") llega a su pico por ahora y va cediendo hacia el mes cuatro. El piel con piel, luces tenues, movimiento (un fular o una caminata lenta) ayudan más que otra toma.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    9, 'recovery',
    'Movement, gently and intentionally',
    'If your provider has cleared you for exercise, the goal at week nine is consistency over intensity. A 15-minute walk daily beats one 60-minute session followed by a four-day rest. Diastasis recti (abdominal separation) is common; before any crunches or planks, find out whether yours has closed enough. Pelvic floor PT is the safest expert opinion here.',
    '🚶', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Movimiento, suave y con intención',
  'Si tu proveedora ya te autorizó hacer ejercicio, la meta en la semana nueve es consistencia más que intensidad. Una caminata de 15 minutos al día le gana a una sesión de 60 minutos seguida de cuatro días de descanso. La diástasis abdominal es común; antes de cualquier abdominal o plancha, averigua si la tuya ya cerró lo suficiente. Una fisio de piso pélvico es la opinión experta más segura aquí.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    9, 'relationships',
    'Friends without babies, friends with babies',
    'Your social bandwidth is small right now and that is a fact, not a moral failing. The friends who are easiest are the ones who don''t need updating — they pick up where you left off. The harder ones are the ones who feel left behind. A two-line text ("thinking of you, still mostly just surviving") is enough to keep the bridge from rotting.',
    '🫧', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Amigas sin bebés, amigas con bebés',
  'Tu ancho de banda social ahora es pequeño y eso es un hecho, no una falla moral. Las amistades más fáciles son las que no necesitan que les pongas al corriente — retoman donde lo dejaron. Las difíciles son las que se sienten dejadas atrás. Un mensaje de dos líneas ("pensando en ti, sigo más bien sobreviviendo") es suficiente para que el puente no se pudra.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    9, 'expert',
    'A pelvic floor PT before any return to running',
    'If your goal is to return to running, jumping, or heavy lifting, get evaluated first. The "couch to 5k" path postpartum starts with diastasis and pelvic floor screening, not with the first jog.',
    '🌸', 'Find a pelvic floor PT', 'experts:home:pelvic_floor',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una fisio de piso pélvico antes de volver a correr',
  'Si tu meta es volver a correr, saltar o cargar pesas, primero evalúate. El camino "del sillón a los 5k" en posparto empieza con tamizaje de diástasis y piso pélvico, no con el primer trote.',
  'Buscar fisio de piso pélvico'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    9, 'peer',
    'A walk-with-stroller meetup',
    'Local Village events often surface mom-and-stroller walks — outside, low-stakes, easy on the social battery. One walk a week is enough to make the days feel less long.',
    '👟', 'Discover events', 'home:EventsList',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Un encuentro de caminar con la carriola',
  'Los eventos locales en The Village suelen incluir caminatas de mamás con carriola — al aire libre, sin presión, suaves para la batería social. Una caminata por semana basta para que los días se sientan menos largos.',
  'Descubrir eventos'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (9, 'medical',   'Before any high-impact exercise, get a pelvic floor and diastasis evaluation.', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (9, 'practical', 'Plan three 15-minute walks this week. Mark them on your calendar like meetings.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (9, 'emotional', 'Send a two-line text to one friend who hasn''t had kids. Bridge maintenance.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (9, 'household', 'Move one piece of clothing back into rotation that fits you now — not pre-baby, not maternity.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (9, 'medical', 'Before any high-impact exercise, get a pelvic floor and diastasis evaluation.', 'Antes de cualquier ejercicio de alto impacto, hazte una evaluación de piso pélvico y diástasis.'),
  (9, 'practical', 'Plan three 15-minute walks this week. Mark them on your calendar like meetings.', 'Planea tres caminatas de 15 minutos esta semana. Márcalas en el calendario como si fueran reuniones.'),
  (9, 'emotional', 'Send a two-line text to one friend who hasn''t had kids. Bridge maintenance.', 'Mándale un mensaje de dos líneas a una amiga que no tenga hijos. Mantenimiento del puente.'),
  (9, 'household', 'Move one piece of clothing back into rotation that fits you now — not pre-baby, not maternity.', 'Vuelve a poner en rotación una prenda que te quede ahora — ni pre-bebé, ni de maternidad.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 10 ───────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    10, 'identity',
    'A new normal is forming',
    'Around week ten, many moms describe a quiet shift: not "I''m back," but "this is the shape of my life now, and I can see it." That doesn''t mean it''s easy — it means the disorientation has dialed down enough to let you make small plans. A coffee with a friend. A book you actually finish. A workout you do twice. Those are the building blocks; they accumulate slowly.',
    '🌅', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Se está formando una nueva normalidad',
  'Alrededor de la semana diez, muchas mamás describen un cambio silencioso: no "ya volví", sino "esta es la forma de mi vida ahora, y la puedo ver". Eso no quiere decir que sea fácil — quiere decir que la desorientación bajó lo suficiente como para dejarte hacer pequeños planes. Un café con una amiga. Un libro que de verdad terminas. Un entrenamiento que haces dos veces. Esos son los ladrillos; se van acumulando despacio.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    10, 'sleep',
    'The longest stretch starts to lengthen',
    'Many babies — not all — start giving 5–6 hour overnight stretches around now. Your job is to be in bed when that stretch is happening. The temptation to use the first 90 minutes for "me time" is real and expensive. Bank the sleep first; the dishes can wait.',
    '🌌', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'El bloque más largo empieza a alargarse',
  'Muchos bebés — no todos — empiezan a dar bloques nocturnos de 5 a 6 horas por estas fechas. Tu trabajo es estar en la cama mientras ese bloque está ocurriendo. La tentación de usar los primeros 90 minutos para "tiempo para mí" es real y cara. Primero cobra el sueño; los platos pueden esperar.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    10, 'emotional',
    'The good days, and how to mark them',
    'Around week ten, you may have a day that feels distinctly less heavy than the ones around it. Notice it on purpose. Postpartum recovery is not linear, and the good days are the data your brain forgets fastest. Telling your partner, journaling a sentence, or just saying "today was lighter" out loud reinforces the trajectory.',
    '🌤️', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Los días buenos, y cómo marcarlos',
  'Alrededor de la semana diez, puede que tengas un día que se sienta claramente menos pesado que los de alrededor. Nótalo a propósito. La recuperación posparto no es lineal, y los días buenos son los datos que tu cerebro olvida más rápido. Decírselo a tu pareja, escribir una oración o solo decir en voz alta "hoy fue más liviano" refuerza la trayectoria.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    10, 'community',
    'A "what week are you in" thread',
    'The postpartum room sorts by stage so you can find moms in week 9, 10, or 11. Reading the in-the-thick-of-it posts from people one week ahead is its own kind of orientation.',
    '🧭', 'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Un hilo de "¿en qué semana estás?"',
  'La sala de posparto se ordena por etapa, así que puedes encontrar mamás en la semana 9, 10 u 11. Leer las publicaciones en pleno frente de batalla de quien está una semana adelante es su propia forma de orientación.',
  'Abrir sala de posparto'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    10, 'expert',
    'A second-opinion well visit, if anything is nagging',
    'If something has felt off but didn''t rise to the 6-week visit conversation — a stitch that still tugs, a thyroid hunch, a low mood your provider waved off — a second-opinion appointment is reasonable, not dramatic.',
    '🩺', 'Find an OB/midwife', 'experts:home:obgyn',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una segunda opinión, si algo sigue molestando',
  'Si algo se ha sentido raro pero no llegó a salir en la visita de las 6 semanas — un punto que sigue jalando, una sospecha tiroidea, un ánimo bajo que tu proveedora minimizó — una cita de segunda opinión es razonable, no dramática.',
  'Buscar OB/partera'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (10, 'medical',   'If anything physical still feels off (pain, leaking, mood), book a follow-up — don''t wait it out.', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (10, 'practical', 'Pick one small "you" plan this week — coffee, a walk, 30 minutes of a hobby. Defend it.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (10, 'emotional', 'Tell your partner one specific thing they did this week that made the day lighter.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (10, 'household', 'Pre-pay or auto-renew anything that requires brain power. Reduce decisions.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (10, 'medical', 'If anything physical still feels off (pain, leaking, mood), book a follow-up — don''t wait it out.', 'Si algo físico sigue raro (dolor, pérdidas, ánimo), agenda una visita de seguimiento — no lo dejes pasar.'),
  (10, 'practical', 'Pick one small "you" plan this week — coffee, a walk, 30 minutes of a hobby. Defend it.', 'Elige un plan pequeño para ti esta semana — un café, una caminata, 30 minutos de un pasatiempo. Defiéndelo.'),
  (10, 'emotional', 'Tell your partner one specific thing they did this week that made the day lighter.', 'Dile a tu pareja una cosa concreta que hizo esta semana que aligeró el día.'),
  (10, 'household', 'Pre-pay or auto-renew anything that requires brain power. Reduce decisions.', 'Paga por adelantado o programa renovaciones automáticas en lo que te exija pensar. Reduce decisiones.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 11 ───────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    11, 'feeding',
    'The first growth spurt of month three',
    'Week 11 often brings a short cluster — a day or two of nearly nonstop feeding and shorter sleeps — that resolves in 24–72 hours. It is the biology of "make more milk, baby is growing." Stay hydrated, stay calm, and trust that the rhythm comes back. Wet diapers are still your reassurance.',
    '🌾', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'El primer pico de crecimiento del tercer mes',
  'La semana 11 suele traer un racimo corto — uno o dos días de tomas casi continuas y siestas más cortas — que se resuelve en 24 a 72 horas. Es la biología de "produce más leche, el bebé está creciendo". Mantente hidratada, mantén la calma, y confía en que el ritmo vuelve. Los pañales mojados siguen siendo tu confirmación.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    11, 'relationships',
    'Re-introducing intimacy at your pace',
    'Many providers clear sexual intercourse around week six; far fewer mothers feel ready then. Around week 11 is a more honest median for many. There is no schedule you''re behind on. Communication, lubrication (your body''s estrogen is still adjusting), and patience are the three variables that matter. Pelvic floor PT addresses pain — don''t white-knuckle it.',
    '💞', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Volver a la intimidad a tu ritmo',
  'Muchas proveedoras autorizan las relaciones sexuales alrededor de la semana seis; muchas menos madres se sienten listas en ese momento. La semana 11 es una mediana más honesta para varias. No hay ningún calendario en el que estés atrasada. Comunicación, lubricación (tu estrógeno todavía se está ajustando) y paciencia son las tres variables que importan. La fisio de piso pélvico atiende el dolor — no aguantes en silencio.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    11, 'recovery',
    'Pelvic floor strength, not just absence of leaks',
    'No leaks doesn''t mean your pelvic floor is back. The deeper goals — load-bearing strength, coordinated breath, no heaviness when you stand all day — take months. A few weeks of focused PT is worth the time; rushing into running or heavy lifting is the most common postpartum injury route.',
    '🌸', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Fuerza del piso pélvico, no solo ausencia de pérdidas',
  'No tener pérdidas no significa que tu piso pélvico esté como antes. Las metas más profundas — fuerza para cargar peso, coordinación con la respiración, sin pesadez después de estar de pie todo el día — toman meses. Unas pocas semanas de fisio enfocada valen el tiempo; lanzarte a correr o cargar pesas es la ruta más común de lesión posparto.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    11, 'expert',
    'A pelvic floor PT package, not a single visit',
    'One visit is screening; 4–6 visits is treatment. Most insurance plans cover a pelvic floor PT package after a referral. If yours doesn''t, ask about cash-pay rates — they''re often lower than expected.',
    '🌷', 'Find a pelvic floor PT', 'experts:home:pelvic_floor',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Un paquete de fisio de piso pélvico, no una sola visita',
  'Una visita es tamizaje; 4 a 6 visitas son tratamiento. La mayoría de los seguros cubren un paquete de fisio de piso pélvico con referencia. Si el tuyo no, pregunta por el costo en efectivo — suele ser más bajo de lo esperado.',
  'Buscar fisio de piso pélvico'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    11, 'community',
    'Honest stories about postpartum sex',
    'The intimacy thread in the postpartum room is plain-spoken, not performative. Real timelines, real friction, real workarounds — useful when nothing else is.',
    '🌙', 'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Historias honestas sobre la intimidad posparto',
  'El hilo de intimidad en la sala de posparto es directo, no performativo. Tiempos reales, fricciones reales, soluciones reales — útil cuando nada más lo es.',
  'Abrir sala de posparto'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (11, 'medical',   'If sex is painful when cleared, ask about pelvic floor PT before assuming it''s "just postpartum."', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (11, 'practical', 'Restock breast pads or nursing supplies — a growth spurt this week may surprise the system.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (11, 'emotional', 'Have one direct conversation with your partner about pace — yours, not the calendar''s.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (11, 'household', 'Spend 10 minutes outside today, alone if possible. The reset is real.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (11, 'medical', 'If sex is painful when cleared, ask about pelvic floor PT before assuming it''s "just postpartum."', 'Si el sexo duele cuando ya estás autorizada, pregunta por fisio de piso pélvico antes de asumir que "es solo posparto".'),
  (11, 'practical', 'Restock breast pads or nursing supplies — a growth spurt this week may surprise the system.', 'Reabastece los discos para los senos o tus insumos de lactancia — un pico de crecimiento esta semana puede sorprenderte.'),
  (11, 'emotional', 'Have one direct conversation with your partner about pace — yours, not the calendar''s.', 'Ten una conversación directa con tu pareja sobre tu ritmo — el tuyo, no el del calendario.'),
  (11, 'household', 'Spend 10 minutes outside today, alone if possible. The reset is real.', 'Pasa 10 minutos al aire libre hoy, sola si se puede. El reinicio es real.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── Week 12 ───────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    12, 'identity',
    'The end of the fourth trimester',
    'Twelve weeks is a soft cultural milestone — the end of the "fourth trimester." Some moms feel a real shift here; others feel exactly the same as week 10 with a different number on the page. Both are right. The fourth trimester is the most clinically distinct postpartum window; what comes next is no less real, just less defined.',
    '🌙', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'El final del cuarto trimestre',
  'Las doce semanas son un hito cultural suave — el final del "cuarto trimestre". Algunas mamás sienten un cambio real aquí; otras se sienten exactamente igual que en la semana 10 con otro número en la página. Ambas tienen razón. El cuarto trimestre es la ventana posparto más distinguible clínicamente; lo que viene después no es menos real, solo menos definido.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    12, 'emotional',
    'Looking back at the version of you from week one',
    'If you can, scroll back to a photo or note from your first week. The contrast is the point. You were softer, scrambled, and brand new at this. You still are at the new parts; the things that felt like crisis in week one are now Tuesday. That is growth, even if it doesn''t feel like it from inside.',
    '🪞', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Mirando atrás a la versión de ti de la semana uno',
  'Si puedes, desplázate atrás a una foto o una nota de tu primera semana. El contraste es el punto. Estabas más suave, descolocada y completamente nueva en esto. Lo sigues estando en las partes nuevas; las cosas que se sentían como crisis en la semana uno ahora son un martes cualquiera. Eso es crecimiento, aunque no se sienta así desde adentro.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (week_number, category, title, body, hero_emoji, requires_crisis_footer, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    12, 'sleep',
    'Sleep training is a choice, not a deadline',
    'Twelve weeks is the earliest age many sleep consultants will work with — and well before any structured "training" is biologically appropriate. If sleep has stabilized into a 4-5-6 hour stretch, ride it. If it hasn''t, gentle consistency (predictable wind-downs, dim lights, a stable bedtime window) does more than rigid methods at this age.',
    '🌌', FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body) SELECT id, 'es',
  'Entrenar el sueño es una decisión, no una fecha límite',
  'Las doce semanas son la edad más temprana con la que trabajan muchas asesoras de sueño — y muy anterior al momento en que cualquier "entrenamiento" estructurado es biológicamente apropiado. Si el sueño se estabilizó en un bloque de 4-5-6 horas, déjalo correr. Si no, la consistencia suave (rutinas previsibles, luces tenues, una ventana estable para acostarse) hace más que los métodos rígidos a esta edad.'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    12, 'expert',
    'A 12-week well-woman visit, separately from baby''s',
    'It''s easy for postpartum follow-up to fall off the calendar after week six. Booking a stand-alone well-woman visit at 12 weeks (and again at 6 months) keeps you on the clinical map.',
    '🩺', 'Find an OB/midwife', 'experts:home:obgyn',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una visita ginecológica de las 12 semanas, separada de la del bebé',
  'Es fácil que el seguimiento posparto se caiga del calendario después de la semana seis. Agendar una visita ginecológica independiente a las 12 semanas (y otra a los 6 meses) te mantiene en el mapa clínico.',
  'Buscar OB/partera'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (week_number, support_type, title, body, hero_emoji, cta_label, cta_target, review_status, clinical_advisor_reviewed, review_notes) VALUES (
    12, 'community',
    'A 0–6 month room ahead of the transition',
    'As you cross 12 weeks, the conversations shift. The 0–6 month room covers introducing solids, the 4-month sleep change, daycare onboarding, and the first round of meaningful illnesses. Easing in now beats arriving cold at week 16.',
    '🌅', 'Open postpartum room', 'community:room:postpartum_06',
    'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label) SELECT id, 'es',
  'Una sala de 0 a 6 meses antes de la transición',
  'Al cruzar las 12 semanas, las conversaciones cambian. La sala de 0 a 6 meses habla de introducir sólidos, el cambio de sueño de los 4 meses, la entrada a guardería y los primeros catarros importantes. Ir entrando ahora es mejor que llegar fría en la semana 16.',
  'Abrir sala de posparto'
FROM new_row;

INSERT INTO week_checklists (week_number, category, item_text, is_essential, sort_order, review_status, clinical_advisor_reviewed, review_notes) VALUES
  (12, 'medical',   'Book a 12-week postpartum check-in with your OB or midwife — separate from the baby visits.', FALSE, 10, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (12, 'practical', 'Take one photo of yourself this week. Future-you will want it.', FALSE, 20, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (12, 'emotional', 'Write down three things that are easier now than at week one. Keep the note.', FALSE, 30, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending'),
  (12, 'household', 'Pack away the newborn-only clothes that don''t fit anymore. The closet wins back space.', FALSE, 40, 'approved', FALSE, 'Seed content — founder approval; clinical advisor review pending');
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT wc.id, 'es', x.es
FROM (VALUES
  (12, 'medical', 'Book a 12-week postpartum check-in with your OB or midwife — separate from the baby visits.', 'Agenda una visita posparto de las 12 semanas con tu OB o partera — aparte de las visitas del bebé.'),
  (12, 'practical', 'Take one photo of yourself this week. Future-you will want it.', 'Tómate una foto esta semana. La tú del futuro la va a querer.'),
  (12, 'emotional', 'Write down three things that are easier now than at week one. Keep the note.', 'Escribe tres cosas que ahora sean más fáciles que en la semana uno. Guarda la nota.'),
  (12, 'household', 'Pack away the newborn-only clothes that don''t fit anymore. The closet wins back space.', 'Guarda la ropa de recién nacido que ya no le quede. El clóset gana espacio.')
) AS x(week_number, category, item_text, es)
JOIN week_checklists wc ON wc.week_number = x.week_number AND wc.category = x.category AND wc.item_text = x.item_text;

-- ─── End migration 037 ───────────────────────────────────────────────────
-- Postpartum 0–12 week window now seeded. Weeks 13–104 can be filled by the
-- AI cron pattern from G7 (`ai-milestone-explainer`) once a clinical advisor
-- has signed off on this batch.
