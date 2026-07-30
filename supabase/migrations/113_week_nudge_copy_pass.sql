-- 113_week_nudge_copy_pass.sql
-- Hand-authored rewrite of all 104 "baby's week" push rows (migration 111).
--
-- WHY: the AI fill in 111 was only ever spot-checked (~10 of 104 rows). A full
-- read-through found defects that a sample could not surface:
--
--   · FACTUAL — week 43 ES pitched the cow's-milk switch ("casi lista para la
--     leche de vaca"). Week 43 is ~10 months; cow's milk as a drink is not
--     advised before 12. Reframed to a general meals prompt, in BOTH locales.
--   · FACTUAL — wrong ages cited: w21 ES said "6 meses" (~4.8mo), w30 ES said
--     "8 meses" (~6.9mo). Age claims are now either correct or removed.
--   · GENDER — "sentadita" (w22), "casi lista" (w43), "solito" (w45) slipped
--     past the 111 regex, which only caught nouns (niño/niña/la bebé). The
--     CHECK below now also covers these diminutive/adjective forms.
--   · DUPLICATES — w18/w21 and w37/w45 were identical in EN, w8/w44 near
--     identical. Same push twice, weeks apart, reads as a bug to the user.
--   · VOICE — "we've got" opened ~35 of 52 EN bodies and "te contamos" ~30 of
--     52 ES; "alrededor de ahora" (a literal calque of "around now") appeared
--     ~20 times. Weekly senders must not feel templated.
--   · REGISTER — w16 ES had drifted into Argentine voseo ("notás", "vos
--     hablás"); the ES voice is neutral Latin American.
--
-- Every replacement row was validated before generation against the banned
-- deadline/comparison list, the gendered-language list, the voseo list, the
-- length limits, and cross-week title uniqueness.
--
-- generator is set to 'hand' so a future `ai-week-nudge-generate` run in
-- 'missing' mode leaves these alone.

UPDATE week_nudges AS wn
SET title      = v.title,
    body       = v.body,
    generator  = 'hand',
    updated_at = now()
FROM (VALUES
    (1, 'en', 'noticing your voice yet?', 'your baby''s been listening to you for months. what these first days often look like, inside.'),
    (2, 'en', 'cluster feeding happening?', 'those back-to-back feeds are normal, and they do pass. what''s behind them, inside.'),
    (3, 'en', 'sleeping in weird chunks?', 'completely normal at three weeks. gentle rhythms some families lean on, inside.'),
    (4, 'en', 'catching any smiles yet?', 'the real ones show up for some babies about now. what those early grins mean, inside.'),
    (5, 'en', 'any neck strength lately?', 'tummy time is doing more than it looks like. the gentle version, inside.'),
    (6, 'en', 'hearing little sounds yet?', 'cooing starts for some babies around this stretch. a simple way to chat back, inside.'),
    (7, 'en', 'eyes following you around?', 'smooth tracking lands for some babies about now. a small game to try, inside.'),
    (8, 'en', 'any longer sleep stretch?', 'some babies string one together now, some not for months. ideas for either, inside.'),
    (9, 'en', 'tiny push-ups happening?', 'lifting the chest during tummy time starts for some. making it easier, inside.'),
    (10, 'en', 'what cracks your baby up?', 'real laughs arrive for some babies about now. what tends to set them off, inside.'),
    (11, 'en', 'feeds going quicker lately?', 'faster usually doesn''t mean less. why that speed is a good sign, inside.'),
    (12, 'en', 'noticing patterns yet?', 'reading what comes next is brand new around this stretch. what it looks like, inside.'),
    (13, 'en', 'rocking or shifting around?', 'weight-shifting shows up for some babies now. where to let them move, inside.'),
    (14, 'en', 'sleep gone sideways?', 'a brain leveling up often shows in the night first. what helps, inside.'),
    (15, 'en', 'staring at their own hands?', 'for a while, hands are the most interesting thing in the room. why, inside.'),
    (16, 'en', 'talking back to you yet?', 'those coos are real conversation. the pause that makes them longer, inside.'),
    (17, 'en', 'rolling both directions?', 'some babies surprise themselves about now. safe floor time, inside.'),
    (18, 'en', 'watching you eat yet?', 'food curiosity starts for some babies in this stretch. the actual readiness signs, inside.'),
    (19, 'en', 'dropping things on repeat?', 'that''s an experiment, not a habit to stop. what''s being learned, inside.'),
    (20, 'en', 'studying new faces lately?', 'that long look at a stranger means something. what it is, inside.'),
    (21, 'en', 'grabby at your plate?', 'interest usually arrives well before readiness does. how to tell them apart, inside.'),
    (22, 'en', 'propping up on hands yet?', 'the tripod sit lands for some babies now. floor setups that help, inside.'),
    (23, 'en', 'everything going in the mouth?', 'the mouth is a research tool right now. safe things to explore, inside.'),
    (24, 'en', 'new sounds showing up?', 'strings of sounds start for some babies about now. how to play along, inside.'),
    (25, 'en', 'any scooting happening?', 'army-crawling arrives for some. babyproofing before you need it, inside.'),
    (26, 'en', 'is peekaboo hilarious now?', 'something new is happening with memory. simple games that land, inside.'),
    (27, 'en', 'how''s it going with lumps?', 'some babies dive into texture, some take months. both fine — ideas inside.'),
    (28, 'en', 'extra clingy to one person?', 'attachment gets loud around this stretch for some. what it means, inside.'),
    (29, 'en', 'rocking on hands and knees?', 'crawling often begins as rocking. floor time that goes with it, inside.'),
    (30, 'en', 'nights gotten messier?', 'a busy brain can make settling harder for a while. what helps, inside.'),
    (31, 'en', 'responding to their name?', 'understanding runs way ahead of talking. what to listen for, inside.'),
    (32, 'en', 'those tiny fingers pinching?', 'thumb-and-finger picking starts for some babies now. what to practice with, inside.'),
    (33, 'en', 'pushing up on their feet?', 'legs are getting strong. what to secure before they pull up, inside.'),
    (34, 'en', 'looking for what falls?', 'things keep existing now, even out of sight. games for that, inside.'),
    (35, 'en', 'copying your gestures?', 'waves and claps get borrowed around this stretch. play that builds on it, inside.'),
    (36, 'en', 'grabbing at your food?', 'self-feeding interest shows up for some babies now. keeping meals survivable, inside.'),
    (37, 'en', 'cruising the furniture yet?', 'sidestepping along the couch starts for some. why tumbles are part of it, inside.'),
    (38, 'en', 'sounds starting to mean things?', 'a first word with intent lands whenever it lands. what to listen for, inside.'),
    (39, 'en', 'turning when you call?', 'simple words start landing for some babies now. everyday moments that build it, inside.'),
    (40, 'en', 'getting messy with food?', 'hands and mouth are learning together right now. texture ideas, inside.'),
    (41, 'en', 'letting go of the couch?', 'standing solo gets tested around this stretch. soft landings, inside.'),
    (42, 'en', 'handing you things?', 'offering you a toy is an invitation. how to answer it, inside.'),
    (43, 'en', 'how are meals landing?', 'most of this year lives somewhere between milk and dinner. ideas, inside.'),
    (44, 'en', 'nights getting longer?', 'sleep consolidates for some babies about now. a calming routine to try, inside.'),
    (45, 'en', 'pulling up on everything?', 'furniture turns into equipment for a while. what to secure first, inside.'),
    (46, 'en', 'any first words yet?', 'some babies are chatting, some are quietly collecting. what to listen for, inside.'),
    (47, 'en', 'pretending with toys?', 'feeding a stuffed animal is big cognitive news. how to play along, inside.'),
    (48, 'en', 'goodbyes getting easier?', 'some babies settle faster at drop-off about now. little rituals that help, inside.'),
    (49, 'en', 'climbing everything?', 'a brand new love of heights arrives for some. safety that works, inside.'),
    (50, 'en', 'appetite all over the place?', 'eating changes a lot near the first year. what to expect, inside.'),
    (51, 'en', 'pointing at things?', 'that finger means "look at this with me". what to do with it, inside.'),
    (52, 'en', 'one year of you two', 'what does your baby do now that would have stunned you a year ago? the whole year, inside.'),
    (1, 'es', '¿ya reconoce tu voz?', 'tu bebé te escuchaba desde antes de nacer. qué pasa en estos primeros días, adentro.'),
    (2, 'es', '¿come sin parar?', 'esas tomas seguidas son normales y van pasando. qué hay detrás, adentro.'),
    (3, 'es', '¿duerme en pedacitos?', 'de lo más normal a las 3 semanas. ritmos suaves que a algunas familias les sirven, adentro.'),
    (4, 'es', '¿ya sonríe mirándote?', 'las sonrisas de verdad llegan por estas semanas para algunos bebés. qué significan, adentro.'),
    (5, 'es', '¿levanta la cabecita?', 'la panza abajo hace más de lo que parece. la versión sin drama, adentro.'),
    (6, 'es', '¿ya hace ruiditos?', 'los primeros sonidos aparecen por estos días en algunos bebés. cómo responderle, adentro.'),
    (7, 'es', '¿te sigue con la mirada?', 'el seguimiento suave llega más o menos ahora. un juego chiquito para probar, adentro.'),
    (8, 'es', '¿alguna noche más larga?', 'a algunos bebés les pasa por esta época, a otros en meses. ideas para las dos, adentro.'),
    (9, 'es', '¿mini flexiones en la panza?', 'levantar el pecho aparece por estas semanas. cómo hacerlo más fácil, adentro.'),
    (10, 'es', '¿qué le da risa?', 'las carcajadas de verdad llegan por estos días para algunos peques. qué las dispara, adentro.'),
    (11, 'es', '¿las tomas más cortas?', 'más rápido no significa menos. por qué suele ser buena señal, adentro.'),
    (12, 'es', '¿anticipa lo que viene?', 'leer las rutinas es algo nuevo en esta etapa. qué está pasando, adentro.'),
    (13, 'es', '¿se mueve distinto?', 'el cambio de peso de un lado a otro aparece por estas semanas. dónde puede moverse con seguridad, adentro.'),
    (14, 'es', '¿el sueño se descompuso?', 'un cerebro que avanza suele mostrarse primero en la noche. qué ayuda, adentro.'),
    (15, 'es', '¿descubrió sus manitas?', 'por un tiempo son lo más interesante del cuarto. por qué pasa, adentro.'),
    (16, 'es', '¿te responde con sonidos?', 'esos arrullos son conversación. la pausa que los hace más largos, adentro.'),
    (17, 'es', '¿rueda para los dos lados?', 'algunos bebés se sorprenden solos por esta época. piso seguro, adentro.'),
    (18, 'es', '¿mira lo que comes?', 'la curiosidad por la comida empieza por estas semanas en algunos. las señales reales, adentro.'),
    (19, 'es', '¿tira todo al piso?', 'eso es un experimento, no una maña. qué está aprendiendo, adentro.'),
    (20, 'es', '¿estudia las caras nuevas?', 'esa mirada larga a quien no conoce significa algo. qué es, adentro.'),
    (21, 'es', '¿quiere agarrar tu plato?', 'el interés llega mucho antes que el momento de empezar. cómo distinguirlos, adentro.'),
    (22, 'es', '¿se sostiene con las manos?', 'sentarse apoyado llega en esta etapa para algunos bebés. cómo acomodar el piso, adentro.'),
    (23, 'es', '¿todo va a la boca?', 'la boca es su herramienta de investigación ahora. qué es seguro ofrecer, adentro.'),
    (24, 'es', '¿sonidos nuevos?', 'encadenar sílabas empieza por estos días en algunos peques. cómo seguirle el juego, adentro.'),
    (25, 'es', '¿se arrastra por el piso?', 'a algunos peques les llega por esta época. cómo preparar la casa antes, adentro.'),
    (26, 'es', '¿le causa gracia el peekaboo?', 'algo nuevo está pasando con la memoria. juegos simples que funcionan, adentro.'),
    (27, 'es', '¿cómo va con los grumos?', 'algunos se lanzan, otros tardan meses. las dos cosas están bien — ideas adentro.'),
    (28, 'es', '¿te busca más que antes?', 'el apego se hace ruidoso en esta etapa para algunos bebés. qué significa, adentro.'),
    (29, 'es', '¿se balancea en cuatro?', 'gatear suele empezar así. juego en el piso que acompaña, adentro.'),
    (30, 'es', '¿las noches más movidas?', 'cerca de los siete meses, una cabeza ocupada cuesta más de apagar. qué ayuda, adentro.'),
    (31, 'es', '¿responde a su nombre?', 'entender va muy por delante de hablar. qué escuchar, adentro.'),
    (32, 'es', '¿agarra cosas chiquitas?', 'la pinza de pulgar e índice aparece por estas semanas. con qué practicar, adentro.'),
    (33, 'es', '¿empuja con los pies?', 'las piernas están agarrando fuerza. qué asegurar antes de que se pare, adentro.'),
    (34, 'es', '¿busca lo que se cae?', 'las cosas siguen existiendo aunque no se vean. juegos para eso, adentro.'),
    (35, 'es', '¿copia tus gestos?', 'los aplausos y los adioses se contagian en esta etapa. cómo jugar con eso, adentro.'),
    (36, 'es', '¿quiere agarrar la comida?', 'comer solo empieza por estas semanas en algunos peques. cómo sobrevivir al desorden, adentro.'),
    (37, 'es', '¿se agarra de los muebles?', 'caminar de lado por el sofá llega por esta época. por qué los tropiezos suman, adentro.'),
    (38, 'es', '¿sus sonidos ya significan?', 'la primera palabra con intención llega cuando llega. qué escuchar, adentro.'),
    (39, 'es', '¿voltea cuando dices su nombre?', 'las palabras simples empiezan a caer en esta etapa. momentos del día que ayudan, adentro.'),
    (40, 'es', '¿ya come con las manos?', 'las manos y la boca están aprendiendo juntas. ideas de texturas, adentro.'),
    (41, 'es', '¿se suelta de los muebles?', 'pararse sin ayuda se prueba por estas semanas. caídas blandas, adentro.'),
    (42, 'es', '¿te ofrece sus juguetes?', 'prestarte algo es una invitación. cómo responderla, adentro.'),
    (43, 'es', '¿cómo van las comidas?', 'casi todo este año vive entre la leche y la mesa. ideas, adentro.'),
    (44, 'es', '¿noches más largas?', 'el sueño se acomoda por esta época para algunos peques. una rutina calmada para probar, adentro.'),
    (45, 'es', '¿se para agarrado de todo?', 'los muebles se vuelven escalera por un tiempo. qué asegurar primero, adentro.'),
    (46, 'es', '¿ya dice palabritas?', 'algunos peques hablan, otros juntan en silencio. qué escuchar, adentro.'),
    (47, 'es', '¿juega a hacer de cuenta?', 'darle de comer a un peluche es una noticia enorme. cómo acompañar, adentro.'),
    (48, 'es', '¿las despedidas más fáciles?', 'algunos peques se calman más rápido en esta etapa. ritualitos que ayudan, adentro.'),
    (49, 'es', '¿se sube a todo?', 'llega el amor por las alturas. seguridad que de verdad sirve, adentro.'),
    (50, 'es', '¿come menos de golpe?', 'cerca del año el apetito cambia mucho. qué esperar, adentro.'),
    (51, 'es', '¿señala las cosas?', 'ese dedito dice "mira esto conmigo". qué hacer con eso, adentro.'),
    (52, 'es', 'un año juntos', '¿qué hace hoy tu bebé que hace un año te habría dejado con la boca abierta? todo el año, adentro.')
) AS v(week_number, locale, title, body)
WHERE wn.kind        = 'week'
  AND wn.variant     = 1
  AND wn.week_number = v.week_number
  AND wn.locale      = v.locale;

-- Tighten the safety CHECK: add the gendered diminutive/adjective forms that
-- the original noun-only pattern missed. Narrowly scoped on purpose — a blanket
-- ban on -ito/-ita endings would reject valid mother-directed copy.
ALTER TABLE week_nudges DROP CONSTRAINT IF EXISTS week_nudges_copy_safe;
ALTER TABLE week_nudges ADD CONSTRAINT week_nudges_copy_safe CHECK (
  (title || ' ' || body) !~* '(should be|should have|should already|must be|by now|falling behind|is behind|other babies|than other|normal babies|deber[ii]a|atrasad|retrasad|otros beb[ee]s|ya tendr[ii]a|sentadit[oa]|solit[oa]|dormidit[oa]|casi list[oa])'
);
