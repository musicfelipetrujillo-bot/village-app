-- 128_mom_tips_spanish.sql
--
-- The Spanish set: 371 rows, one for every (week, day) that English has.
--
-- WHY IT MATTERS MORE THAN A NORMAL TRANSLATION: the read RPCs match locale
-- EXACTLY (`AND t.locale = p_locale`), so before this migration a Spanish mom
-- got nothing at all from mom_tips. The client papers over it — getTipForToday
-- and listTipsForWeek retry with 'en' on an empty result — but that means she
-- was reading English inside a Spanish app. This replaces that fallback with
-- the real thing.
--
-- VOICE: the same rule as English, which is the whole point of the feature —
-- your sister telling you what to buy, not a manual explaining a concept.
-- Translated for sense, never word for word. "Blowouts stay out of his hair"
-- becomes "así el desastre no termina en el pelo", not a literal rendering of
-- "blowout". Neutral Latin-American Spanish, tú, no voseo, no peninsular
-- vocabulary (cierre not cremallera, pañalera not bolsa cambiador).
--
-- ⚠️ GRAMMATICAL GENDER: the English copy says "he" throughout — a choice the
-- founder made for English. Spanish cannot do that quietly: every adjective and
-- pronoun would have to agree, so half of all users would read copy about a
-- baby of the wrong gender in a way English never exposes. These rows are
-- written NEUTRAL instead — "tu bebé", "le", reflexives — which reads naturally
-- and is correct for everyone. Keep it that way if you add more.
--
-- ⚠️ LANDS AS 'draft', like everything else. The reviewer surface already
-- handles this: `list_mom_tips_for_review(week)` returns all locales for a
-- week, and `approve_mom_tips_week` only touches rows still in draft — so
-- approving a week now flips the seven Spanish rows and leaves the already
-- approved English ones alone. Spanish moms keep getting the English fallback
-- until that pass happens.
--
-- Idempotent: re-running updates only rows still in draft, so it can never
-- overwrite text a reviewer has already approved.

INSERT INTO mom_tips (week_number, day_index, category, title, body, locale)
VALUES
  -- ── semanas 0-9 · recién nacido ──────────────────────────────────────────
  (0,0,'care',$$Envolturas con cierre, no de velcro$$,$$El velcro suena fuerte cada vez que lo abres, y a las 3am ese ruido es justo lo que despierta al bebé.$$,'es'),
  (0,1,'care',$$Arma la cuna en capas$$,$$Protector, sábana, protector, sábana. A las 3am quitas las dos de arriba y ya hay cama limpia debajo.$$,'es'),
  (0,2,'care',$$Pañales en cada cuarto donde te sientas$$,$$Toallitas y un mameluco de repuesto también. No vas a caminar hasta el cuarto a las 4am, ni tienes por qué.$$,'es'),
  (0,3,'care',$$Los dobleces del mameluco son una salida$$,$$Bájalo por los hombros en vez de sacarlo por la cabeza. Así el desastre no termina en el pelo.$$,'es'),
  (0,4,'you',$$Prepara todo antes de sentarte$$,$$Agua y algo de comer a la mano. Cuando se prende no te mueves en media hora.$$,'es'),
  (0,5,'feed',$$Deja listos los biberones de la noche$$,$$Medir cucharadas medio dormida es como pierdes la cuenta y tienes que empezar otra vez.$$,'es'),
  (0,6,'sleep',$$El ruido blanco en su propio aparato$$,$$Si usas el celular lo agarras para apagarlo, y ahí la que se despierta eres tú. Uno sencillo cuesta como $20.$$,'es'),

  (1,0,'care',$$Chupón con cinta plana, no de cuentas$$,$$Las cuentas se le entierran en el cachete cuando gira la cabeza, y termina escupiéndolo.$$,'es'),
  (1,1,'care',$$Compra el segundo chupón$$,$$Déjalo en el carro. El que sí acepta es justo el que se te va a perder.$$,'es'),
  (1,2,'you',$$Sal en una foto esta semana$$,$$Dale tu celular a alguien. Si no, terminas con cientos del bebé y ninguna de los dos juntos.$$,'es'),
  (1,3,'care',$$Camisetas de lado mientras tiene el ombligo$$,$$Nada pasa por encima de la cabeza y no tienes que tocar el cordón para vestirle.$$,'es'),
  (1,4,'you',$$Guarda hoy el número de guardia$$,$$El del pediatra, en tus contactos. No es algo para andar buscando a las 2am con una sola mano.$$,'es'),
  (1,5,'feed',$$Pañal de tela en los dos hombros$$,$$Va a voltear la cabeza justo en el momento que importa.$$,'es'),
  (1,6,'you',$$Empaca una camiseta para ti$$,$$En la pañalera, junto a la del bebé. Vas a necesitar cambiarte más seguido de lo que crees.$$,'es'),

  (2,0,'care',$$Córtale las uñas mientras come$$,$$Las manos se le quedan quietas y ni se entera. Despierto y manoteando es como terminas picándole un dedito.$$,'es'),
  (2,1,'you',$$Dale una tarea a las visitas$$,$$Que traigan comida o laven los platos. Casi todos quieren ayudar y están esperando que les digas cómo.$$,'es'),
  (2,2,'sleep',$$Envuélvele antes de que esté desesperado$$,$$Cuando ya está llorando los brazos no entran. Apunta al bostezo, no al grito.$$,'es'),
  (2,3,'feed',$$Las manos a la boca avisan antes que el llanto$$,$$Buscar con la boca y los puños en la cara vienen primero. Si le das ahí, el agarre es más tranquilo para las dos.$$,'es'),
  (2,4,'care',$$Dos estaciones de cambio, no una$$,$$Una donde duermes y otra donde pasas el día. Cruzar la casa en cada cambio cansa desde el martes.$$,'es'),
  (2,5,'you',$$Una botella de agua en cada lugar donde te sientas$$,$$Amamantar da una sed que nadie te advierte. Llena tres en la mañana y déjalas repartidas.$$,'es'),
  (2,6,'play',$$Sostenle como a un palmo de tu cara$$,$$Es hasta donde alcanza a enfocar ahora. Más cerca de lo que se siente natural es justo lo correcto.$$,'es'),

  (3,0,'feed',$$Prepárate para las tomas de la tarde$$,$$Cerca de la cena va a querer comer sin parar por horas. Pon algo que ver y ten snacks cerca en vez de pelear con eso.$$,'es'),
  (3,1,'care',$$Calienta la toallita en tu mano$$,$$Dos segundos bastan. Una toallita fría en una colita tibia es grito seguro, y no necesitas comprar calentador.$$,'es'),
  (3,2,'sleep',$$Acuéstale despierto una vez al día$$,$$Una, no todas. Es práctica para más adelante y ahorita no te cuesta nada.$$,'es'),
  (3,3,'you',$$Di que sí cuando te ofrezcan cargarle$$,$$Báñate, come algo caliente, acuéstate. No tienes que ganarte esos veinte minutos.$$,'es'),
  (3,4,'care',$$Una capa más de la que traes tú$$,$$Una, no tres. Se acalora más seguido de lo que se enfría, y adentro de la casa no necesita gorro.$$,'es'),
  (3,5,'feed',$$Sacar el aire no dura un tiempo fijo$$,$$A veces sale en diez segundos y a veces no hace falta. Si está tranquilo, déjalo así.$$,'es'),
  (3,6,'play',$$Cuéntale lo que estás haciendo$$,$$El cambio de pañal, el café, el camino a la puerta. Es lo más fácil que puedes hacer por su lenguaje y es gratis.$$,'es'),

  (4,0,'care',$$La foto del mes, siempre en el mismo lugar$$,$$Misma silla, misma luz, cada mes. Verlas juntas al año es de lo que se trata.$$,'es'),
  (4,1,'you',$$Agenda ya tu consulta posparto$$,$$Los espacios se llenan con semanas. Apúntalo hoy aunque la cita sea dentro de un mes.$$,'es'),
  (4,2,'sleep',$$Oscurece bien el cuarto$$,$$Un panel blackout barato le gana a las cortinas bonitas. Las siestas mejoran cuando el cuarto deja de decirle que es mediodía.$$,'es'),
  (4,3,'feed',$$Deja un biberón en la rotación$$,$$Si el biberón va a ser parte de tu vida, no esperes a necesitarlo. Uno cada tantos días basta para que lo siga aceptando.$$,'es'),
  (4,4,'care',$$Compra la siguiente talla antes de que la necesites$$,$$Va a saltar de talla sin avisar. Tenerla ya en el cajón es mejor que un pedido de madrugada.$$,'es'),
  (4,5,'you',$$Sal de la casa una vez esta semana$$,$$Dar la vuelta a la cuadra cuenta. La primera salida es la difícil y después se vuelve fácil.$$,'es'),
  (4,6,'play',$$Las tarjetas en blanco y negro le ganan a los juguetes$$,$$El alto contraste es lo que alcanza a ver. Un juego de tarjetas barato le entretiene más que algo con luces.$$,'es'),

  (5,0,'sleep',$$Las mismas tres cosas antes de dormir$$,$$Bajar la luz, envolver, ruido blanco. Importa menos cuáles sean que el orden nunca cambie.$$,'es'),
  (5,1,'feed',$$Una liga en la muñeca del lado que empezaste$$,$$Más rápido que desbloquear una app. La pasas al otro lado cuando cambias.$$,'es'),
  (5,2,'care',$$Una capa de crema en cada cambio de la noche$$,$$Cinco segundos ahora es más fácil que tres días curando una colita irritada.$$,'es'),
  (5,3,'you',$$Reparte la hora difícil$$,$$Si hay alguien más en casa, la tarde es suya. Es el rato más pesado del día y no tiene por qué tocarte siempre a ti.$$,'es'),
  (5,4,'play',$$El tiempo boca abajo sobre tu pecho cuenta$$,$$En el piso es pelea a esta edad. Recuéstate y ponlo sobre ti: los mismos músculos, sin el llanto.$$,'es'),
  (5,5,'care',$$Revisa las correas de la silla cada tanto$$,$$Deben quedar a la altura de los hombros o justo abajo, y subir conforme crece. Se desajusta sin que lo notes.$$,'es'),
  (5,6,'you',$$Ten una lista abierta en las notas$$,$$Se te ocurren tres preguntas a las 2am y ninguna en la consulta. Una sola lista lo arregla.$$,'es'),

  (6,0,'feed',$$La semana en que quiere comer sin parar$$,$$Son unos días y pasa. No rearmes toda tu rutina alrededor de eso.$$,'es'),
  (6,1,'play',$$Devuélvele la sonrisa siempre$$,$$Las primeras de verdad llegan por aquí. Contestarlas es lo que hace que las repita.$$,'es'),
  (6,2,'sleep',$$Si dormir es pelea, adelanta la hora$$,$$Un bebé pasado de cansancio pelea más. Media hora antes funciona mejor que media hora después.$$,'es'),
  (6,3,'care',$$Una muda en el carro, no solo en la pañalera$$,$$La pañalera es la que se te olvida. El carro siempre está ahí.$$,'es'),
  (6,4,'you',$$La misma caminata, a la misma hora$$,$$Escoge una ruta. Es lo más barato que de verdad les ayuda a las dos.$$,'es'),
  (6,5,'play',$$El ventilador de techo es entretenimiento gratis$$,$$Vas a comprar juguetes que ignora. Un ventilador lo deja viendo diez minutos.$$,'es'),
  (6,6,'feed',$$Un segundo juego de piezas del extractor$$,$$Lavar entre cada sesión es lo que hace que la gente lo deje. Un repuesto te regala una ronda entera.$$,'es'),

  (7,0,'sleep',$$Deja de envolver cuando empiece a pelearlo$$,$$Sacar un brazo o girar de lado es la señal. No es una batalla que haya que ganar.$$,'es'),
  (7,1,'you',$$Contesta los mensajes todos juntos$$,$$Todo el mundo quiere una foto. Una ronda a la misma hora cada día evita que el celular te maneje el día.$$,'es'),
  (7,2,'feed',$$El biberón horizontal, no inclinado$$,$$Sale más lento, traga menos aire y devuelve menos. Búscalo como "alimentación a ritmo" si quieres el método completo.$$,'es'),
  (7,3,'care',$$Compra más muselinas de las que crees$$,$$Para el aire, para el sol, para limpiar, para taparte. Es lo único de lo que nunca te vas a arrepentir de tener diez.$$,'es'),
  (7,4,'play',$$Ponle donde pueda verte trabajar$$,$$Una hamaca en la puerta de la cocina te da veinte minutos, y tú le interesas más que cualquier juguete.$$,'es'),
  (7,5,'you',$$Dos conjuntos con los que te sientas bien$$,$$Ni de maternidad ni de antes. Dos cosas que le queden al cuerpo que tienes hoy, en rotación.$$,'es'),
  (7,6,'care',$$Con bañarlo dos veces por semana basta$$,$$No se está ensuciando y la piel se le reseca rápido. Un paño húmedo cubre el resto.$$,'es'),

  (8,0,'you',$$Deja libre la tarde de las vacunas$$,$$Puede quedar somnoliento y pegajoso. Sin planes y a dormir temprano, y las dos salen bien.$$,'es'),
  (8,1,'sleep',$$Baja el colchón antes de que se impulse$$,$$La semana en que empieza a levantarse con los brazos. Son cinco minutos que si no, haces con prisa y susto.$$,'es'),
  (8,2,'feed',$$Congela la leche acostada$$,$$Las bolsas planas se apilan como archivos y se descongelan en minutos. Paradas te comen un estante entero.$$,'es'),
  (8,3,'play',$$Pega algo arriba del cambiador$$,$$Cualquier cosa que mirar convierte los peores tres minutos del día en los más fáciles.$$,'es'),
  (8,4,'care',$$Si se sale de noche, sube una talla$$,$$Solo para la noche, y los más chicos se quedan para el día.$$,'es'),
  (8,5,'you',$$Pon una cosa tuya en el calendario$$,$$Un corte de pelo, un café, lo que sea con hora. Los planes vagos no sobreviven a un recién nacido.$$,'es'),
  (8,6,'sleep',$$Mira el reloj, no solo al bebé$$,$$Una hora y algo despierto es suficiente ahorita. Acostarlo antes del bostezo le gana a acostarlo después del berrinche.$$,'es'),

  (9,0,'feed',$$Calienta el biberón en una taza con agua caliente$$,$$Más rápido que un calentador y no lavas nada. Nunca en el microondas: calienta en puntos que no se sienten.$$,'es'),
  (9,1,'care',$$Usa los puños del mameluco, no los mitones$$,$$Todas las pijamas los traen. Los mitones se pierden en la segunda semana.$$,'es'),
  (9,2,'you',$$Pide algo concreto$$,$$"Ven a las cuatro y cárgalo mientras duermo" funciona. "Avísame si necesitas algo" nunca.$$,'es'),
  (9,3,'sleep',$$Que no todas las siestas sean en la cuna$$,$$Una en el portabebés o la carriola te mantiene cuerda y a él capaz de dormir fuera de casa.$$,'es'),
  (9,4,'play',$$Un espejo en el piso boca abajo$$,$$Va a mirar al otro bebé del espejo mucho más que a cualquier juguete, y de paso levanta la cabeza.$$,'es'),
  (9,5,'feed',$$Si rechaza el biberón, sal del cuarto$$,$$Te huele. Que se lo dé otra persona mientras no estás resuelve la mitad de los casos.$$,'es'),
  (9,6,'care',$$Practica las hebillas del portabebés con un peluche$$,$$Un estacionamiento con un bebé llorando es mal lugar para aprender dónde va cada correa.$$,'es')
ON CONFLICT (week_number, day_index, locale) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body,
      category = EXCLUDED.category, updated_at = now()
  WHERE mom_tips.review_status = 'draft';

INSERT INTO mom_tips (week_number, day_index, category, title, body, locale)
VALUES
  -- ── semanas 10-19 · el ritmo, y el cambio de los cuatro meses ────────────
  (10,0,'sleep',$$Dale diez minutos antes de entrar$$,$$Un ciclo de sueño dura como cuarenta minutos. Una mano en el pecho durante diez puede regalarte otro completo.$$,'es'),
  (10,1,'care',$$Ten tres sábanas de cuna$$,$$Una puesta, una en el cajón, una en la lavadora. Con dos no alcanza la primera noche que pasa dos veces.$$,'es'),
  (10,2,'feed',$$Los chupones del biberón se gastan$$,$$Si de pronto las tomas tardan el doble, revisa el chupón antes de culpar al bebé. Se tapan y se aplastan con el uso.$$,'es'),
  (10,3,'you',$$Di en voz alta lo que piensas a las 3am$$,$$Mándale mensaje a una amiga, cuéntale a tu pareja. Se encoge apenas sale de tu cabeza, y crece si se queda adentro.$$,'es'),
  (10,4,'play',$$Dale algo que de verdad pueda agarrar$$,$$Ya estira la mano a propósito. Un aro o una sonaja ligera convierten eso en práctica.$$,'es'),
  (10,5,'care',$$Rellena la pañalera al llegar, no al salir$$,$$Salir es justo cuando ya vas tarde y alguien está llorando.$$,'es'),
  (10,6,'sleep',$$La cuna en tu cuarto por ahora$$,$$La recomendación son al menos seis meses. También es mucho menos caminar a las 3am.$$,'es'),

  (11,0,'you',$$Pide el súper a domicilio$$,$$El costo del envío es la niñera más barata que vas a contratar.$$,'es'),
  (11,1,'feed',$$Anota la fecha, no el día$$,$$"Martes" no significa nada tres semanas después. Fecha y hora, en la bolsa, con marcador permanente.$$,'es'),
  (11,2,'care',$$Revísale los deditos cuando nada funciona$$,$$Un cabello suelto puede enrollarse en un dedo y doler de verdad. Es fácil no verlo; si no puedes quitarlo, llama al pediatra.$$,'es'),
  (11,3,'sleep',$$Prueba una toma antes de que te acuestes$$,$$A ver si el primer tramo se alarga. Una semana basta para saber si a tu bebé le funciona.$$,'es'),
  (11,4,'play',$$Cuelga algo donde le caigan las manos$$,$$Fallar cincuenta veces es justo el punto. Manotearlo es como aprende a atinar.$$,'es'),
  (11,5,'you',$$Come una comida sentada$$,$$De pie en la barra con el bebé encima no es comer. Una comida al día en una mesa de verdad.$$,'es'),
  (11,6,'care',$$Quita el reductor cuando lo diga el peso$$,$$Busca el número en el manual de la silla en vez de calcularlo a ojo.$$,'es'),

  (12,0,'sleep',$$Empieza la rutina antes de que esté cansado$$,$$Veinte minutos de luz baja y calma antes. Arrancar cuando ya llora es consolar, no dormir.$$,'es'),
  (12,1,'feed',$$Junta la reserva de leche poco a poco$$,$$Una extracción extra al día desde ahora. Desesperarte dos semanas antes de volver al trabajo no funciona.$$,'es'),
  (12,2,'you',$$Busca guardería aunque falte mucho$$,$$Las listas de espera son todo el juego. Visitar tres lugares a los tres meses le gana a correr a los ocho.$$,'es'),
  (12,3,'care',$$Sombra y manga larga antes que bloqueador$$,$$Antes de los seis meses la recomendación es cubrir y evitar el sol. Un gorro de ala ancha hace casi todo el trabajo.$$,'es'),
  (12,4,'play',$$Este mes sus manos son el juguete$$,$$Veinte minutos chupándose el puño es desarrollo, no hambre. Déjale.$$,'es'),
  (12,5,'sleep',$$Suelta la envoltura un brazo a la vez$$,$$Unas noches con un brazo afuera, luego el otro. De golpe es una semana dura para todos.$$,'es'),
  (12,6,'you',$$Guarda diez minutos que sean tuyos$$,$$Un libro, una vuelta sin la carriola, un café afuera. Chiquito y diario le gana a grande y nunca.$$,'es'),

  (13,0,'care',$$La baba empieza mucho antes que los dientes$$,$$Baberos desde ya. Te ahorra tres cambios de ropa al día y la irritación que viene con ellos.$$,'es'),
  (13,1,'sleep',$$En la cuna, nada más que el bebé$$,$$Sin chichoneras, sin almohadas, sin cobijas, sin posicionadores. La cuna vacía es la segura.$$,'es'),
  (13,2,'feed',$$Dale de comer en un lugar aburrido$$,$$El mundo se puso interesante y se suelta con cada ruido. Un cuarto oscuro y callado reduce el tiempo a la mitad.$$,'es'),
  (13,3,'play',$$El "¿dónde está?" ya funciona$$,$$Está descubriendo que sigues ahí detrás de tus manos. Además son diez minutos gratis.$$,'es'),
  (13,4,'you',$$Agenda tus propias citas de una vez$$,$$Dentista, ojos, lo que traes pendiente. Todo en una sentada, mientras ya lo tienes en la cabeza.$$,'es'),
  (13,5,'care',$$Un cesto de ropa sucia en el cuarto$$,$$La ropa se quita donde se ensucia. Sin cesto ahí, el piso se vuelve el cesto.$$,'es'),
  (13,6,'sleep',$$Las 5am son de noche, no de mañana$$,$$Sin luz, sin plática, de vuelta a la cuna. Levantarse arranca el día y eso lo aprende rapidísimo.$$,'es'),

  (14,0,'sleep',$$El cambio de los cuatro meses es real$$,$$El sueño se vuelve más ligero y cortado unas semanas. Es desarrollo, no algo que hiciste mal: sostén la rutina.$$,'es'),
  (14,1,'feed',$$Los sólidos no arreglan el sueño$$,$$Es el consejo que más vas a oír y no se sostiene. Espera las señales, no la sugerencia de un desconocido.$$,'es'),
  (14,2,'care',$$Sécale la baba durante el día$$,$$La irritación del cuello casi siempre es baba ahí sentada. Secar es más fácil que curar.$$,'es'),
  (14,3,'play',$$Más piso que silla$$,$$Hamacas y columpios lo dejan en una sola postura. Diez minutos en un tapete hacen más que una hora sentado.$$,'es'),
  (14,4,'you',$$Se te va a caer el pelo a puños$$,$$Como a los tres o cuatro meses, y después para. Es normal, y una trampa en la coladera te salva la tubería.$$,'es'),
  (14,5,'care',$$Compra el saco de dormir en la talla que sigue$$,$$Cuando ya no hay envoltura, mantiene el calor sin nada suelto en la cuna.$$,'es'),
  (14,6,'sleep',$$La misma hora de despertar, aunque duerma mal$$,$$Anclar la mañana ordena el resto del día mucho más que anclar la noche.$$,'es'),

  (15,0,'play',$$Todo va directo a la boca$$,$$Tus lentes, tu pelo, tu comida. Mueve la taza caliente antes de sentarte, no después.$$,'es'),
  (15,1,'feed',$$La señal es sentarse firme, no la edad$$,$$Los sólidos se acercan cuando sostiene la cabeza y se sienta con apoyo. Más cerca de los seis meses que de los cuatro.$$,'es'),
  (15,2,'care',$$Sube lo frágil un estante$$,$$Todavía no gatea, y por eso justo esta semana es la fácil para hacerlo.$$,'es'),
  (15,3,'you',$$Repártanse la noche por turnos$$,$$Una hasta las 2am y la otra después. Cuatro horas seguidas cada una le ganan a ocho cortadas.$$,'es'),
  (15,4,'sleep',$$Protege la siesta del mediodía$$,$$Organiza los pendientes alrededor. Las otras pueden ser en la carriola; esa vale la pena estar en casa.$$,'es'),
  (15,5,'play',$$El mismo cuento cada noche$$,$$La repetición es la parte que le gusta. Tú te vas a hartar mucho antes que él.$$,'es'),
  (15,6,'care',$$Lava los juguetes una vez por semana$$,$$Todo está yendo a la boca. Agua caliente con jabón o la rejilla de arriba, un día fijo a la semana.$$,'es'),

  (16,0,'feed',$$Saca la periquera antes de tiempo$$,$$Que se siente ahí un par de semanas durante tus comidas. Silla conocida, primera cucharada más fácil.$$,'es'),
  (16,1,'sleep',$$Seis meses es la recomendación de cuarto compartido$$,$$Si estás contando los días, ese es el número. Después, cuándo moverlo lo decides tú.$$,'es'),
  (16,2,'you',$$Di que no a una cosa esta semana$$,$$Una visita, una cena, un bautizo. Puedes declinar sin dar razones, y se vuelve más fácil con la práctica.$$,'es'),
  (16,3,'care',$$Cinco centímetros de agua en la tina grande$$,$$Agrega un vaso de plástico. Son veinte minutos de entretenimiento que no cuestan nada.$$,'es'),
  (16,4,'play',$$Dos juguetes afuera, no veinte$$,$$Juega más tiempo con menos cosas. Guarda el resto y rótalos cada par de semanas: se sienten nuevos.$$,'es'),
  (16,5,'feed',$$Dale algo a las manos mientras come$$,$$Una muselina o un juguete chico. Evita los pellizcos y arañazos que empiezan por aquí.$$,'es'),
  (16,6,'care',$$El abrigo se quita antes de la silla$$,$$Un abrigo grueso bajo las correas las deja flojas y sin función. Abróchalo primero y el abrigo encima.$$,'es'),

  (17,0,'sleep',$$Cuando ya gira, déjale acomodarse solo$$,$$Sigue acostándolo boca arriba. Cuando gira solo en los dos sentidos, no tienes que voltearlo toda la noche.$$,'es'),
  (17,1,'play',$$Déjale golpear cosas entre sí$$,$$Dos bloques, una cuchara de madera, una olla. El ruido que él provoca es toda la lección.$$,'es'),
  (17,2,'you',$$Que otra persona lo duerma una vez por semana$$,$$La primera vez sale mal y a la tercera sale bien. Las dos necesitan que alguien más también pueda dormirlo.$$,'es'),
  (17,3,'feed',$$Las primeras comidas necesitan hierro$$,$$Es lo único en lo que la guía de los seis meses es firme. Tu pediatra te dice cuáles para tu bebé.$$,'es'),
  (17,4,'care',$$Solo compra el gorro que trae cinta$$,$$Cualquier otro es un gorro que pierdes la primera semana.$$,'es'),
  (17,5,'sleep',$$Recorta la siesta de la tarde$$,$$Una larga después de las cuatro te la cobra a la hora de dormir. Despiértalo y aguanta los veinte minutos de mal humor.$$,'es'),
  (17,6,'you',$$Graba video, no solo fotos$$,$$Quince segundos balbuceando van a valer más después que otras cien fotos.$$,'es'),

  (18,0,'feed',$$Solo en pañal para las primeras comidas$$,$$Vuela por todos lados. Un bebé sin ropa y un trapo le ganan a dos cambios completos al día.$$,'es'),
  (18,1,'care',$$Pon algo debajo de la periquera$$,$$Una cortina de baño barata sirve. Si no, el piso se vuelve trabajo tres veces al día.$$,'es'),
  (18,2,'play',$$Tira cosas para ver cómo caen$$,$$Es causa y efecto, no majadería. Amarra un par de juguetes a la silla y sálvate la espalda.$$,'es'),
  (18,3,'sleep',$$Llévate la rutina de viaje$$,$$Mismo orden, mismo ruido blanco, mismo saco. El cuarto puede cambiar; la secuencia no.$$,'es'),
  (18,4,'you',$$Cocina doble y congela la mitad$$,$$De algo que de verdad te comerías. Las noches entre semana dejan de ser una decisión.$$,'es'),
  (18,5,'feed',$$Ofrece agua en vaso abierto$$,$$Sorbos con la comida desde como los seis meses. Un vaso abierto o un popote enseñan más que uno con boquilla.$$,'es'),
  (18,6,'care',$$Frío mejor que geles para los dientes$$,$$Un paño mojado frío o un mordedor del refri hacen más que casi todo lo que venden. Pregunta antes de usar cualquier medicina o gel.$$,'es'),

  (19,0,'play',$$Dale algo blandito para que coma solo$$,$$Una tira de plátano es toda una actividad. Lento y sucio, pero agarrar y masticar es el punto.$$,'es'),
  (19,1,'sleep',$$No entres al primer ruidito$$,$$Se quejan entre ciclos y se vuelven a acomodar solos. Un minuto escuchando te evita despertarlo del todo.$$,'es'),
  (19,2,'you',$$Actualiza los contactos de emergencia$$,$$Quien pueda recogerlo, en el pediatra y donde lo dejes. Hazlo antes de necesitarlo.$$,'es'),
  (19,3,'feed',$$Alérgenos pronto y seguido, no evitarlos$$,$$La guía de hoy es uno a la vez, en casa, y mantenerlos en la rotación. Tu pediatra te dice cómo para tu bebé.$$,'es'),
  (19,4,'care',$$Engancha el mordedor a la carriola$$,$$Todo lo que agarra termina en la banqueta. El clip cuesta dos dólares y te ahorra el regreso.$$,'es'),
  (19,5,'play',$$Nómbralo cuando se lo pasas$$,$$Vaso. Cuchara. Perro. La misma palabra, el mismo objeto, siempre: así se pegan las primeras.$$,'es'),
  (19,6,'care',$$Una segunda bolsa que viva en el carro$$,$$Pañales, toallitas, una muda y un snack para ti. No la que cargas: otra que nunca entra a la casa.$$,'es')
ON CONFLICT (week_number, day_index, locale) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body,
      category = EXCLUDED.category, updated_at = now()
  WHERE mom_tips.review_status = 'draft';

INSERT INTO mom_tips (week_number, day_index, category, title, body, locale)
VALUES
  -- ── semanas 20-29 · sólidos, sentarse, y la semana en que se mueve ───────
  (20,0,'feed',$$Dos cucharas: una tuya y una suya$$,$$Él agita la suya mientras tú usas la otra. Es más lento y es la única forma en que aprende a hacerlo solo.$$,'es'),
  (20,1,'sleep',$$La siesta se mueve, no desaparece$$,$$De tres pasa a dos en algún punto de aquí. Sigue sus señales una semana antes de rehacer el horario.$$,'es'),
  (20,2,'care',$$Revisa la casa de rodillas$$,$$Cables, esquinas de mesa, el plato del perro. Desde abajo se ve un cuarto completamente distinto.$$,'es'),
  (20,3,'you',$$Escribe las tareas invisibles$$,$$Donde tu pareja pueda verlas. Lo que no está escrito se queda contigo por default, y eso nadie lo decidió a propósito.$$,'es'),
  (20,4,'play',$$Los tópers le ganan a los juguetes$$,$$Sacar cosas y volverlas a meter es el juego de varios meses. No cuesta nada.$$,'es'),
  (20,5,'feed',$$Las arcadas suenan; el atragantamiento es silencioso$$,$$La arcada es él resolviéndolo solo y se ve terrible. Aprende la diferencia antes de empezar sólidos: un curso de primeros auxilios vale la tarde.$$,'es'),
  (20,6,'care',$$Nada redondo y firme, nunca$$,$$Uvas enteras, tomatitos, nueces. Pártelo a lo largo en cuatro o déjalo fuera: esa forma es la peligrosa.$$,'es'),

  (21,0,'sleep',$$Cambia una cosa y espera cuatro noches$$,$$Si estás arreglando el sueño, tres cambios a la vez no te dicen cuál funcionó.$$,'es'),
  (21,1,'play',$$Siéntalo en el piso, no en el sofá$$,$$Se va de lado sin avisar durante unas semanas. Piso, cojín atrás, listo.$$,'es'),
  (21,2,'you',$$Acuéstate cuando él se acueste, una vez por semana$$,$$No a adelantar la casa. A dormir de verdad. Una noche cambia la semana entera.$$,'es'),
  (21,3,'feed',$$Congela el puré en cubiteras$$,$$Una charola es una semana de comidas y no se desperdicia nada por descongelar de más.$$,'es'),
  (21,4,'care',$$Uñas el mismo día cada semana$$,$$Los rasguños en su propia cara son el recordatorio. Un día fijo es más fácil que acordarse.$$,'es'),
  (21,5,'sleep',$$Deja el ruido blanco toda la noche$$,$$Apagarlo cuando ya se durmió es la razón por la que lo despierta cualquier ruido. Es una máscara, no una canción de cuna.$$,'es'),
  (21,6,'you',$$Escribe una línea sobre esta semana$$,$$En el celular. No vas a acordarte en qué semana se descubrió los pies, y lo vas a querer saber.$$,'es'),

  (22,0,'feed',$$Sepárale su porción antes de sazonar$$,$$Come lo mismo que tú, sin sal. Cocinas menos y aprende tu comida, no comida de bebé.$$,'es'),
  (22,1,'care',$$Tapa los enchufes antes de que se mueva$$,$$Pasa de quieto a cruzar el cuarto en quince días. Ahorita es un pendiente tranquilo; después es carrera.$$,'es'),
  (22,2,'play',$$Quiere justo lo que tú estás usando$$,$$Un control viejo, una caja vacía, una cuchara de verdad. Que sea tuyo es el atractivo; que sea juguete no.$$,'es'),
  (22,3,'sleep',$$Un diente son unas noches malas, no una etapa nueva$$,$$Sálvalas como puedas. Solo no construyas un hábito permanente para resolver una semana.$$,'es'),
  (22,4,'you',$$Anótate en la lista aunque no estés segura$$,$$Siempre puedes soltar el lugar. Lo que no puedes es brincarte la fila porque cambiaste de opinión en marzo.$$,'es'),
  (22,5,'feed',$$Que rechace algo no es un veredicto$$,$$Hacen falta muchas veces para que algo le resulte familiar. Sigue ofreciéndolo sin convertirlo en evento.$$,'es'),
  (22,6,'care',$$Cuchara y babero viven en el carro$$,$$El único día que andes fuera a la hora de la comida es el día que los vas a necesitar.$$,'es'),

  (23,0,'play',$$Gatear empieza en reversa$$,$$Se va a empujar lejos de lo que quiere y se va a enojar. Ponle el juguete atrás de vez en cuando para que gane.$$,'es'),
  (23,1,'sleep',$$Menos siesta pide dormir más temprano$$,$$Suena al revés y funciona. Pasarse de cansado es lo que vuelve pelea la hora de dormir.$$,'es'),
  (23,2,'care',$$Las rejas antes de que gatee, no después$$,$$Arriba y abajo. Instalarlas con un bebé que ya se mueve es trabajo de dos personas y te va a molestar.$$,'es'),
  (23,3,'you',$$Pon una salida en el calendario$$,$$Aunque sea en meses. Que exista ahí ya te hace algo hoy, pase lo que pase esa noche.$$,'es'),
  (23,4,'feed',$$Nada de miel hasta el año$$,$$Ni una probadita, ni en pan, ni en el chupón. El queso y el yogur están bien; esa espera doce meses.$$,'es'),
  (23,5,'play',$$Está estudiando tu cara$$,$$Saca la lengua, levanta las cejas, exagera todo. Tu cara es el mejor juguete del cuarto.$$,'es'),
  (23,6,'care',$$Un tapete donde juega$$,$$Piso duro y alguien que apenas se sienta no combinan. Un tapete barato cuesta menos que los golpes.$$,'es'),

  (24,0,'feed',$$Escribe las dudas de comida antes de ir$$,$$En la consulta tienes diez minutos y se te olvida justo la que importaba.$$,'es'),
  (24,1,'sleep',$$Acorta la rutina ahora$$,$$Baño, cuento, cama es suficiente. Las rutinas largas se vuelven difíciles conforme se pone más interesante.$$,'es'),
  (24,2,'play',$$Déjalo a quince centímetros$$,$$Ni tan lejos que sea cruel. Esa distancia es la diferencia entre frustración y motivación.$$,'es'),
  (24,3,'you',$$Suelta una cosa que no te esté sirviendo$$,$$A medio año, parte de tu rutina es costumbre y no ayuda. Tienes permiso de dejarla.$$,'es'),
  (24,4,'care',$$Limpia el primer diente una vez al día$$,$$Un paño suave o un cepillito. Todavía no hace falta pasta, salvo que tu dentista diga otra cosa.$$,'es'),
  (24,5,'feed',$$Siéntate a comer con él$$,$$Masticar se aprende viendo. Si tú comes de pie mientras él come sentado, se pierde la demostración.$$,'es'),
  (24,6,'care',$$El bloqueador se permite desde los seis meses$$,$$Cara, manos, nuca: lo que se asoma de la carriola. La sombra sigue haciendo casi todo el trabajo.$$,'es'),

  (25,0,'play',$$Una pelota, un vaso, una cuchara, una caja$$,$$Cuatro cosas cubren meses. El juguete caro con botones dura diez minutos.$$,'es'),
  (25,1,'sleep',$$Cuarto fresco, una capa, saco de dormir$$,$$Entre 18 y 20 grados es lo que se recomienda. A esta edad da más problemas el calor que el frío.$$,'es'),
  (25,2,'you',$$Un consejo no es una instrucción$$,$$Este año te van a llegar de todos lados. "Qué interesante, gracias" es una respuesta completa.$$,'es'),
  (25,3,'feed',$$Pasa de los purés lisos mientras acepta$$,$$Grumos a los siete meses es más fácil que grumos a los diez. La textura es una habilidad con ventana.$$,'es'),
  (25,4,'care',$$Marca todo de una sola vez$$,$$Antes de la guardería. Biberones, sacos, gorros, cada calcetín: con un marcador, en una sentada.$$,'es'),
  (25,5,'play',$$Dale un cajón en la cocina$$,$$Tazones de plástico y cucharas de madera, sin seguro. Ahí están los veinte minutos que necesitas para cocinar.$$,'es'),
  (25,6,'you',$$Pregunta lo aburrido en la guardería$$,$$Quién lo cambia, qué hacen si no quiere dormir, cómo te avisan de un mal día. Lo demás lo cubre el recorrido.$$,'es'),

  (26,0,'feed',$$Una o dos comidas al día bastan$$,$$A los seis meses la leche sigue haciendo el trabajo pesado. Tres comidas es a dónde vas, no de dónde sales.$$,'es'),
  (26,1,'sleep',$$Trae a casa la siesta larga$$,$$La carriola deja de funcionar conforme se pone más curioso. La otra todavía puede ser en cualquier lado.$$,'es'),
  (26,2,'play',$$Apóyalo desde atrás, no de frente$$,$$De frente estira los brazos para que lo cargues. Desde atrás practica el equilibrio.$$,'es'),
  (26,3,'care',$$Menos comida en el plato, y rellenas$$,$$Los tazones con succión te dan unos meses y luego les agarra el truco. Poquito, rellenado, sobrevive más.$$,'es'),
  (26,4,'you',$$Imprime una foto de verdad$$,$$La de los seis meses. Todo lo que tienes vive en un celular, y los celulares se pierden y se rompen.$$,'es'),
  (26,5,'feed',$$Leche primero, comida después, por ahora$$,$$Así una comida a medias no le quita las calorías que todavía son las que cuentan.$$,'es'),
  (26,6,'care',$$Usa la correa de entrepierna de la periquera$$,$$Es la que evita que se resbale hacia abajo. Siempre, aunque sea un snack de dos minutos.$$,'es'),

  (27,0,'play',$$Va directo a lo único peligroso$$,$$Lo que dejaste afuera es el objeto más interesante del cuarto. No es desobediencia, es novedad.$$,'es'),
  (27,1,'feed',$$Déjalo embarrarse$$,$$Apachurrarla con las manos es como aprende qué es la comida. Cara limpia, cero aprendizaje.$$,'es'),
  (27,2,'sleep',$$Di lo mismo cada vez que sales del cuarto$$,$$Ya le pesa que te vayas. Unas palabras cortas siempre iguales y volver de verdad le ganan a escaparte sin avisar.$$,'es'),
  (27,3,'care',$$Revisa límites de la silla, no la edad$$,$$La siguiente silla va por estatura y peso. El número está en el manual, no en la caja.$$,'es'),
  (27,4,'you',$$Aquí empiezan las comparaciones$$,$$El bebé de alguien va a gatear antes, dormir mejor, comer más. Quédate con una persona con la que puedas ser honesta.$$,'es'),
  (27,5,'play',$$Esconde un juguete bajo una tela$$,$$Primero a medias, luego completo. Está aprendiendo que las cosas existen aunque no las vea.$$,'es'),
  (27,6,'feed',$$Un snack aburrido en cada bolsa$$,$$El colapso casi siempre es hambre y no avisa. Algo seco que aguante una semana en la bolsa.$$,'es'),

  (28,0,'sleep',$$Las habilidades nuevas se practican a las 2am$$,$$Gatear y pararse aparecen primero de noche. Dale más piso de día y pasa más rápido.$$,'es'),
  (28,1,'care',$$Calcetines con antiderrapante$$,$$En cuanto se mueve en piso duro, los calcetines normales convierten el pasillo en pista de hielo.$$,'es'),
  (28,2,'you',$$Sal de la casa sin él una vez$$,$$Una hora, el motivo que sea. La primera vez se siente raro y después es solo una hora.$$,'es'),
  (28,3,'feed',$$Algo para agarrar y algo de cuchara$$,$$Dos texturas en la charola. Le mantiene las manos ocupadas y entra más.$$,'es'),
  (28,4,'play',$$Las mismas tres canciones, con movimientos$$,$$Va a hacer los aplausos mucho antes de poder decir una sola palabra.$$,'es'),
  (28,5,'care',$$Deja un gabinete sin seguro$$,$$Llénalo de tazones de plástico y cucharas de madera. Va a escoger ese y dejar en paz los que importan.$$,'es'),
  (28,6,'sleep',$$Papel aluminio en la ventana en verano$$,$$Las mañanas claras arruinan el sueño rápido. Se ve horrible desde la calle y funciona.$$,'es'),

  (29,0,'feed',$$Pon el vaso aunque lo ignore$$,$$Que le sea familiar ahora significa que no está aprendiendo algo nuevo después, cuando ya lo necesita.$$,'es'),
  (29,1,'play',$$Arma una pista con cojines$$,$$Cajas, almohadas, un túnel de sillas. Gatear se pone interesante cuando hay algo que cruzar.$$,'es'),
  (29,2,'you',$$Junta los trámites en una noche$$,$$Formatos, citas, papeles de la guardería. Repartidos en la semana se sienten infinitos.$$,'es'),
  (29,3,'sleep',$$Las siestas en la guardería no se parecen a las de casa$$,$$Más cortas, con ruido, en colchoneta, y va a poder. No rehagas tus noches para que empaten.$$,'es'),
  (29,4,'care',$$Fotografía la etiqueta de lo que ames$$,$$El saco, el biberón, el bloqueador. En cuatro meses vas a querer exactamente lo mismo, una talla más.$$,'es'),
  (29,5,'feed',$$Sirve dos pedazos a la vez$$,$$Un plato lleno termina en el piso. Uno casi vacío que sigues rellenando, no.$$,'es'),
  (29,6,'care',$$Rellena la bolsa de la guardería el domingo$$,$$Las mañanas entre semana no son el momento para andar buscando un saco limpio.$$,'es')
ON CONFLICT (week_number, day_index, locale) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body,
      category = EXCLUDED.category, updated_at = now()
  WHERE mom_tips.review_status = 'draft';

INSERT INTO mom_tips (week_number, day_index, category, title, body, locale)
VALUES
  -- ── semanas 30-39 · pararse, primeras palabras, el bache de los nueve ────
  (30,0,'care',$$Baja el colchón a lo más bajo esta semana$$,$$Se va a parar en la cuna antes de hacerlo frente a ti. No esperes a que te lo demuestre.$$,'es'),
  (30,1,'feed',$$Tiras que quepan en su puño$$,$$Más blandas de lo que crees y más largas que su mano. Maneja mucho más de lo que sugiere el puré.$$,'es'),
  (30,2,'sleep',$$Practiquen cómo VOLVER a sentarse$$,$$Se para en la cuna y se queda atorado. Diez minutos practicando sentarse, de día, acaban con el llanto de las 2am.$$,'es'),
  (30,3,'play',$$Vacía lo que tú llenes$$,$$Dale una canasta que sí se pueda vaciar y el librero queda en paz.$$,'es'),
  (30,4,'you',$$El primer trimestre de guardería es un catarro tras otro$$,$$Es agotador y es normal. Abastécete, cuenta con los días en casa, y no lo leas como que elegiste mal.$$,'es'),
  (30,5,'care',$$La cubierta de lluvia vive en la carriola$$,$$No en el clóset, donde se queda perfectamente seca y perfectamente inútil.$$,'es'),
  (30,6,'feed',$$Veinte minutos es una buena comida$$,$$Terminar mientras va bien le gana a exprimir tres cucharadas más y acabar en llanto.$$,'es'),

  (31,0,'play',$$Repítelo bien, no lo corrijas$$,$$"Aba" cuenta como agua. Di la palabra completa con entusiasmo en vez de decirle que se equivocó.$$,'es'),
  (31,1,'sleep',$$Pararse, dientes y extrañarte, todo junto$$,$$Caen el mismo mes y el sueño se resiente. Deja la rutina idéntica y se acomoda en un par de semanas.$$,'es'),
  (31,2,'care',$$Sin zapatos hasta que camine afuera$$,$$Descalzo o con suela suave es mejor para cómo se le forma el pie. Que le midan cuando ya camine.$$,'es'),
  (31,3,'you',$$Dos horas a la semana, agendadas y repetidas$$,$$Con alguien más cubriendo. El tiempo que sobra nunca llega; el que se aparta, sí.$$,'es'),
  (31,4,'feed',$$Agua con las comidas de aquí en adelante$$,$$Lo acostumbra al vaso y evita que la leche lo llene antes de comer.$$,'es'),
  (31,5,'play',$$Señala lo que él está mirando$$,$$Nombrarlo mientras ya lo mira es como se pegan las palabras. En un par de meses te señala de vuelta.$$,'es'),
  (31,6,'care',$$Un juguete que solo vive en el carro$$,$$Sigue siendo interesante justo porque nunca entra a la casa. Cámbialo cada pocas semanas.$$,'es'),

  (32,0,'sleep',$$Acorta el rato despierto antes de quitar una siesta$$,$$Pasado de cansancio se ve casi igual que no tener sueño. Casi siempre es lo primero.$$,'es'),
  (32,1,'feed',$$El yogur es la mejor comida de práctica$$,$$Se queda pegado en la cuchara mientras la agita. Avance sin sopa por todos lados.$$,'es'),
  (32,2,'care',$$Primero el gabinete de la limpieza$$,$$Lo demás puede esperar una semana. Ese toma diez minutos y es el que importa.$$,'es'),
  (32,3,'play',$$Si te ríes, lo vuelve a hacer$$,$$Y otra vez. Cuarenta veces. La repetición es todo el chiste para él.$$,'es'),
  (32,4,'you',$$Pon por escrito lo que necesitas del trabajo$$,$$Extracciones, hora de salida, los días que no se mueven. Amable, por correo, antes de tu primer día.$$,'es'),
  (32,5,'sleep',$$Cambia el hábito de día, no a las 3am$$,$$Dormirlo en brazos está bien si te funciona. Si no quieres seguir así en tres meses, cámbialo un martes en la tarde.$$,'es'),
  (32,6,'care',$$Reparte varios chupones en la cuna$$,$$Puede encontrar uno solo a las 2am en vez de llamarte a ti para que lo hagas.$$,'es'),

  (33,0,'play',$$Compra libros de cartón y cuenta con bajas$$,$$Las solapas se arrancan. Que uno sea el sacrificado y ten la cinta a la mano.$$,'es'),
  (33,1,'feed',$$Pon en el desayuno lo que más te importa$$,$$El apetito está cargado a la mañana. La cena es la comida que se rechaza.$$,'es'),
  (33,2,'sleep',$$Dos siestas: media mañana y después de comer$$,$$Casi todos caen por ahí. Tómalo como punto de partida y muévelo según él, no según el reloj.$$,'es'),
  (33,3,'care',$$Este mes ya levanta una migaja$$,$$La pinza cambia lo que cuenta como peligro. Vuelve a revisar el piso a su altura.$$,'es'),
  (33,4,'you',$$La foto de las cuatro generaciones$$,$$Con quien esté. Es la que nadie piensa en tomar hasta que ya no se puede tomar.$$,'es'),
  (33,5,'play',$$Los vasos apilables duran más que todo$$,$$Apilar, encajar, llenar, tirar, morder. Seis dólares y cuatro años de uso.$$,'es'),
  (33,6,'feed',$$No lo persigas con la cuchara$$,$$Voltear la cara significa terminó. Perseguirlo convierte la comida en algo que hay que resistir.$$,'es'),

  (34,0,'care',$$Ahora que se agarra de todo, las esquinas importan$$,$$Se sostiene de los muebles para moverse. La esquina de la mesa de centro y la chimenea son las que agarran a todos.$$,'es'),
  (34,1,'sleep',$$La hora de dormir dentro de una ventana de media hora$$,$$Importa menos la hora exacta que el rango. Tarde una vez está bien; tarde al azar es lo que desarma todo.$$,'es'),
  (34,2,'you',$$Arregla una cosa que te molesta a diario$$,$$El cajón que se atora, el foco fundido. Chico, barato, y lo notas todos los días.$$,'es'),
  (34,3,'feed',$$Déjale tomar de tu vaso$$,$$Solo agua. Va a querer el tuyo de todos modos, y enseña a sorber más rápido que cualquier vaso entrenador.$$,'es'),
  (34,4,'play',$$Algo nuevo en cada cambio de pañal$$,$$Un objeto distinto cada vez. Diez segundos de curiosidad son todo el cambio a esta edad.$$,'es'),
  (34,5,'care',$$Toma foto de las correas bien puestas$$,$$Para que quien lo abroche tenga con qué comparar en vez de adivinar.$$,'es'),
  (34,6,'you',$$Aparta ya al fotógrafo del primer año$$,$$Los buenos se llenan con meses, y la vas a querer cerca del cumpleaños, no después.$$,'es'),

  (35,0,'play',$$Arriba, abajo, arriba, abajo, todo el día$$,$$Es una etapa y es corta. Un portabebés de cadera le salva la espalda a tu espalda.$$,'es'),
  (35,1,'feed',$$Tres comidas y leche, más o menos ahora$$,$$Los sólidos pasan al centro en los próximos meses. Sigue su apetito, no una tabla.$$,'es'),
  (35,2,'sleep',$$Arregla las noches primero, las siestas después$$,$$Las siestas son más difíciles y suelen mejorar solas cuando la noche ya está firme.$$,'es'),
  (35,3,'care',$$Exprime los juguetes del baño$$,$$Los que echan agua guardan moho por dentro donde no ves. Cuando se pongan negros, a la basura.$$,'es'),
  (35,4,'you',$$Ordena un solo cuarto antes de dormir$$,$$Diez minutos, uno solo. Despertar con un espacio en orden hace más de lo que debería.$$,'es'),
  (35,5,'play',$$Cópialo tú primero$$,$$Golpea cuando él golpea, balbucea lo que él balbucea. Los turnos son la raíz de la conversación y empiezan aquí.$$,'es'),
  (35,6,'care',$$Un cambio completo guardado en la guardería$$,$$Así una mañana mala en casa nunca se convierte en problema a la hora de dejarlo.$$,'es'),

  (36,0,'feed',$$Aventar la comida significa que terminó$$,$$Es una señal, no mala conducta. Retira la charola en vez de negociar con alguien que todavía no habla.$$,'es'),
  (36,1,'sleep',$$Acuéstalo una vez y sal$$,$$Si se para y llora, hazlo en silencio y vete. Convertirlo en conversación a la 1am es lo que lo alarga una hora.$$,'es'),
  (36,2,'you',$$Automatiza una molestia recurrente$$,$$El recibo que pagas a mano, el pedido que repites. Quítatelo de encima para siempre.$$,'es'),
  (36,3,'play',$$El reciclaje le gana a cualquier juguete con pilas$$,$$Tubos de cartón, cartones de huevo, una caja grande. Ten un bote y renuévalo cada semana.$$,'es'),
  (36,4,'care',$$El primer corte de pelo, en casa y en la periquera$$,$$Un snack y tijeras sin punta. El salón puede esperar a que quedarse quieto sea una decisión suya.$$,'es'),
  (36,5,'feed',$$Leche de vaca para cocinar, no para tomar$$,$$Como ingrediente está bien ahora; como bebida espera al año. Tu pediatra te lo confirma.$$,'es'),
  (36,6,'sleep',$$Mueve la hora diez minutos por noche$$,$$Cuando cambie el horario o el plan. Una hora de golpe te cuesta una semana.$$,'es'),

  (37,0,'play',$$Déjale empujar una silla del comedor$$,$$Más estable que un andador de juguete y no se le va de las manos. Gratis, y ya está en el cuarto.$$,'es'),
  (37,1,'care',$$Las uñas justo después del baño$$,$$Están blandas y él está tranquilo. La mitad del tiempo que cuando está peleando.$$,'es'),
  (37,2,'you',$$Cuéntale a alguien cómo va de verdad$$,$$Una vez al mes, a alguien que no vaya a tratar de arreglarlo. Decirlo en voz alta es todo el punto.$$,'es'),
  (37,3,'feed',$$Una comida al día en la mesa con todos$$,$$Aunque solo sea un snack mientras ustedes comen. Lo que estás construyendo es la costumbre, no las calorías.$$,'es'),
  (37,4,'sleep',$$Las negociaciones empiezan antes que las palabras$$,$$Mismo orden, misma duración, sin discutir. La resistencia a dormir crece hasta llenar el espacio que le des.$$,'es'),
  (37,5,'play',$$Rueden una pelota de ida y vuelta$$,$$La va a empujar antes de poder lanzarla. Es el primer juego que de verdad juegan juntos.$$,'es'),
  (37,6,'care',$$Ten dos abrigos, no uno$$,$$Siempre hay uno mojado o en la guardería. Es de lo que todo el mundo tiene exactamente uno y se arrepiente.$$,'es'),

  (38,0,'feed',$$Dos snacks al día, a horas fijas$$,$$Estar picando todo el día es casi siempre la razón por la que rechaza la cena. Agua entre medio.$$,'es'),
  (38,1,'sleep',$$Un segundo aire a las 7pm significa tarde, no temprano$$,$$De repente está chistosísimo y rebotando en las paredes: eso es pasado de cansancio. Adelanta, no atrases.$$,'es'),
  (38,2,'care',$$Aprieta los tornillos de la cuna$$,$$Un año de sacudidas afloja todo. Diez minutos con una llave allen, dos veces al año.$$,'es'),
  (38,3,'you',$$Respalda las fotos esta semana$$,$$Un año de fotos viviendo en un solo celular es lo más frágil que tienes.$$,'es'),
  (38,4,'play',$$Te va a traer cosas una y otra vez$$,$$Pasarte un objeto es su forma de abrir conversación. Recíbelo, nómbralo, devuélveselo.$$,'es'),
  (38,5,'feed',$$Siéntate a su altura mientras come$$,$$Estar parada encima de él acorta las comidas. Acerca una silla y cambia todo.$$,'es'),
  (38,6,'care',$$Un gancho junto a la puerta para la bolsa$$,$$Rellenada, en el gancho, siempre. Las mañanas que empiezan buscándola empiezan mal.$$,'es'),

  (39,0,'sleep',$$Los nueve meses son el mismo bache que los ocho$$,$$Gatear, pararse y extrañarte llegan juntos otra vez. Nada se descompuso y también se pasa.$$,'es'),
  (39,1,'play',$$Entiende el "no" antes de obedecerlo$$,$$Dilo una vez y luego muévelo tú. Repetirlo más fuerte es lo que le enseña a ignorarlo.$$,'es'),
  (39,2,'you',$$Pide ayuda para el cumpleaños desde ahora$$,$$Lo que quieras que sea ese día, dilo con tiempo. Es más fácil que hacerlo todo a las 11pm de la víspera.$$,'es'),
  (39,3,'feed',$$Deja un tenedor servido junto a su mano$$,$$No lo va a usar bien en meses. Empezar ahora es justo por lo que algún día pasa.$$,'es'),
  (39,4,'care',$$Deja el baño cerrado$$,$$La taza y el cepillo del baño son lo primero que encuentra todo el que gatea. Un gancho alto lo resuelve.$$,'es'),
  (39,5,'sleep',$$Dale diez minutos a las 5am$$,$$Quejarse muchas veces termina en otros cuarenta minutos. Entrar termina la noche para las dos.$$,'es'),
  (39,6,'play',$$Nombra las partes en cada cambio$$,$$Nariz, pies, panza, siempre en el mismo orden. Convierte la lucha en una rutina que hasta le gusta.$$,'es')
ON CONFLICT (week_number, day_index, locale) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body,
      category = EXCLUDED.category, updated_at = now()
  WHERE mom_tips.review_status = 'draft';

INSERT INTO mom_tips (week_number, day_index, category, title, body, locale)
VALUES
  -- ── semanas 40-52 · de agarrarse a caminar, y el primer cumpleaños ───────
  (40,0,'care',$$Enséñale a bajar las escaleras de reversa$$,$$Va a trepar antes de que estés lista. Bajar con los pies por delante es algo que pueden practicar juntas.$$,'es'),
  (40,1,'feed',$$Primero la comida, después la leche$$,$$Los sólidos pasan al centro por aquí. Cambiar el orden suele ser toda la transición que hace falta.$$,'es'),
  (40,2,'sleep',$$Todavía no bajes a una sola siesta$$,$$Eso suele pasar entre los doce y los dieciocho meses. Una mala semana peleando la segunda no es la señal.$$,'es'),
  (40,3,'play',$$Una caja grande de lado$$,$$Meterse y salirse es todo el juego ahora. Nada que puedas comprar le gana.$$,'es'),
  (40,4,'you',$$Que la despedida en la guardería sea aburrida$$,$$Mismas palabras, rápido, con buena cara, y te vas. Alargarla es más duro para las dos, no más cariñoso.$$,'es'),
  (40,5,'care',$$Baberos con mangas para lo que tenga salsa$$,$$Es la diferencia entre limpiarle la cara y cambiarlo entero.$$,'es'),
  (40,6,'feed',$$Juzga cómo come por semana, no por comida$$,$$El apetito se mueve muchísimo a esta edad. Un día de rechazo no te dice absolutamente nada.$$,'es'),

  (41,0,'play',$$Dile lo que sigue$$,$$"Pañal, zapatos, y salimos." Entiende mucho más de lo que puede decir, y eso evita la mitad de los pleitos.$$,'es'),
  (41,1,'sleep',$$Cambia el cuento, no el orden$$,$$Lo que funciona es que sea predecible. El libro puede ser otro; la secuencia no.$$,'es'),
  (41,2,'care',$$Quítale la charola a la periquera de vez en cuando$$,$$Acércalo a la mesa con todos. Copia a la gente que puede ver.$$,'es'),
  (41,3,'you',$$Altérnense dejarlo y recogerlo$$,$$Si pueden los dos. Una mañana difícil cada uno le gana a que una persona haga cinco.$$,'es'),
  (41,4,'feed',$$Que tenga algo en cada mano$$,$$Una cuchara y un pedacito. Con las manos llenas deja de arrebatarte la tuya.$$,'es'),
  (41,5,'play',$$Canta la misma canción cuarenta veces$$,$$La repetición es justo lo que hace que las palabras se peguen. Tu oído no es el que importa aquí.$$,'es'),
  (41,6,'care',$$Capas, no un abrigo grueso$$,$$Las capas se quitan en el carro y se vuelven a poner afuera. Un abrigo grueso es asarse o congelarse.$$,'es'),

  (42,0,'sleep',$$Las muelas son las difíciles$$,$$No se parecen en nada a los dientes de adelante. Frío y paciencia, y pregunta antes de darle cualquier medicina.$$,'es'),
  (42,1,'feed',$$Sirve primero lo que más te importa$$,$$Cuando tiene más hambre. Las verduras al principio de la comida les va mucho mejor que al final.$$,'es'),
  (42,2,'you',$$Decide el tema del biberón a propósito$$,$$Después del año cuesta más quitarlo. Escoge tú el momento en vez de llegar a los dos años todavía con él.$$,'es'),
  (42,3,'play',$$Las escaleras son habilidad, no solo peligro$$,$$Practicar subir y bajar contigo le gana a una reja que tarde o temprano aprende a treparse. Ten las dos.$$,'es'),
  (42,4,'care',$$El saco de dormir según la temporada$$,$$El mismo grosor todo el año es un bebé sudado o uno con frío a las 4am.$$,'es'),
  (42,5,'sleep',$$Que el cuarto sea aburrido$$,$$Nada en la cuna que se prenda o suene. Ser aburrido es todo el trabajo del cuarto.$$,'es'),
  (42,6,'you',$$Di que sí a una invitación$$,$$Vas a querer cancelar. Ve, y vete temprano si hace falta: lo difícil es decidir, no ir.$$,'es'),

  (43,0,'play',$$No lo agarres de las manos por encima de la cabeza$$,$$Le cambia el equilibrio. Que se agarre de los muebles, o de una mano baja, y suéltalo más de lo que te da comodidad.$$,'es'),
  (43,1,'feed',$$Una sola cena, su porción cortada$$,$$Cocinar dos veces es lo que vuelve esto agotador. Sepárale lo suyo antes de la sal.$$,'es'),
  (43,2,'care',$$Gorro y bloqueador viven en la bolsa$$,$$Anda más afuera y más en movimiento. Volver a aplicarlo es la parte que todos olvidan.$$,'es'),
  (43,3,'sleep',$$Una noche desvelada no arruina nada$$,$$Una boda, un vuelo, una fiesta. Vuelve a lo normal al día siguiente y se acomoda solo.$$,'es'),
  (43,4,'you',$$Cancela lo que pagas y no usas$$,$$Suscripciones, la clase, el gimnasio que no pisas desde marzo. Diez minutos, dinero real.$$,'es'),
  (43,5,'play',$$Levantarlo significa "mira esto"$$,$$No te está pidiendo nada. Mirarlo y decir qué es, es toda la respuesta que necesita.$$,'es'),
  (43,6,'feed',$$Una rotación corta está bien$$,$$La variedad cuenta a lo largo de un mes, no de un día. Repetir lo que sí come no es fracaso.$$,'es'),

  (44,0,'sleep',$$Si aparecen las 5am, acorta la siesta de la mañana$$,$$Demasiado sueño temprano puede adelantar todavía más el despertar. Prueba eso antes que cualquier otra cosa.$$,'es'),
  (44,1,'care',$$Córtale tú el fleco$$,$$Una línea recta mientras come. Que no le tape los ojos importa más que quede bonito.$$,'es'),
  (44,2,'you',$$Haz el cumpleaños chiquito$$,$$No se va a acordar y tú la vas a pasar mejor. La presión viene toda de otra gente.$$,'es'),
  (44,3,'feed',$$Déjalo rechazar sin que reacciones$$,$$Tu reacción es lo que convierte la comida en herramienta. Retírala tranquila y ofrécela otra vez en dos días.$$,'es'),
  (44,4,'play',$$Pregunta y espera cinco segundos$$,$$"¿Dónde está el perro?" y luego silencio. La pausa es lo que convierte el libro en conversación.$$,'es'),
  (44,5,'sleep',$$Las siestas del fin de semana como entre semana$$,$$La guardería lo trae con un horario. Mantenerlo el sábado no te cuesta nada y te salva el lunes.$$,'es'),
  (44,6,'care',$$Bolsas y abrigos, arriba$$,$$Medicinas, vitaminas y pastillas viven en las bolsas, y ya alcanza un abrigo colgado en una silla.$$,'es'),

  (45,0,'play',$$Siéntense a unos metros y déjalo cruzar$$,$$Los primeros pasos se dan hacia alguien, no solos. La motivación hace más que la práctica.$$,'es'),
  (45,1,'feed',$$Cambia una toma a la vez$$,$$Si vas a pasar al vaso, cambia una, sostenla una semana, luego la siguiente. La de dormir se va al final.$$,'es'),
  (45,2,'care',$$Zapatos solo para la calle$$,$$Suaves, flexibles y medidos, no calculados. Adentro, descalzo sigue siendo mejor.$$,'es'),
  (45,3,'sleep',$$Caminar despierta de noche$$,$$Es el mismo patrón que cada habilidad nueva y se pasa igual. No rehagas nada.$$,'es'),
  (45,4,'you',$$Agenda ya la consulta del año$$,$$Es más larga que las otras. Lleva tu lista y aprovecha para preguntar lo de la leche y el biberón.$$,'es'),
  (45,5,'play',$$Cualquier cosa con una ranura para meter cosas$$,$$Meter, sacar, meter otra vez. Le dura más que cualquier pantalla.$$,'es'),
  (45,6,'care',$$Amarra todos los cordones que alcance$$,$$Sobre todo los de cortinas y persianas. Los manteles y los cables se vienen abajo con él colgado.$$,'es'),

  (46,0,'feed',$$Las manos hacen el trabajo por meses$$,$$Ofrece la cuchara, no la impongas. Los cubiertos son habilidad lenta y con hambre no se enseña.$$,'es'),
  (46,1,'sleep',$$Los ratos despierto se alargan$$,$$Tres o cuatro horas entre sueños para casi todos. Si las siestas son pelea, casi siempre es por ahí.$$,'es'),
  (46,2,'you',$$Un día libre no es un día de quehacer$$,$$Si te toca uno sin él, la mitad puede ser la casa. La mitad, no todo.$$,'es'),
  (46,3,'care',$$Saca de la bolsa lo de recién nacido$$,$$Sigues cargando pañales talla 1 y una envoltura. Diez minutos y pesa la mitad.$$,'es'),
  (46,4,'play',$$Dale la versión de verdad$$,$$Un cepillo real, un vaso real, un celular sin pila. Las versiones de juguete ya no lo engañan.$$,'es'),
  (46,5,'feed',$$Las uvas se siguen partiendo en cuatro$$,$$La regla no se vence al año. Redondo, firme y del tamaño de un bocado sigue siendo la forma peligrosa por años.$$,'es'),
  (46,6,'sleep',$$No hay prisa por la cama de niño$$,$$La cuna es segura y contenida. No hay premio por adelantarse y sí muchas caminatas a las 2am.$$,'es'),

  (47,0,'play',$$Va a probar la misma regla diez veces$$,$$No para molestarte, para ver si es de verdad. La décima respuesta tiene que ser igual que la primera.$$,'es'),
  (47,1,'care',$$Compra el abrigo una talla más, en rebajas$$,$$Su talla es la que se agota primero cada invierno. Cómpralo antes y guárdalo.$$,'es'),
  (47,2,'you',$$Cuéntale el año a alguien en voz alta$$,$$A quien lo vivió contigo. Nombrar lo que de verdad hiciste es parte de cerrarlo.$$,'es'),
  (47,3,'feed',$$Una comida nueva por semana, junto a una conocida$$,$$Lo nuevo al lado de lo seguro funciona. Un plato entero de desconocidos, no.$$,'es'),
  (47,4,'sleep',$$Llévate el saco, el ruido y las palabras$$,$$Cambie lo que cambie en el viaje, esas tres no. Son sobre lo que en realidad se está durmiendo.$$,'es'),
  (47,5,'play',$$Crayones gordos y papel pegado a la mesa$$,$$Diez minutos vigilados en la periquera. Los primeros rayones caen por aquí.$$,'es'),
  (47,6,'care',$$Revisa las correas otra vez antes del frío$$,$$Lo de septiembre queda apretado sobre un suéter en diciembre. Y el abrigo siempre encima, nunca debajo.$$,'es'),

  (48,0,'feed',$$Dos cucharadas en un tazón a su alcance$$,$$Servirse solo es un desastre y es como se aprende a medir. Rellena en vez de llenar.$$,'es'),
  (48,1,'sleep',$$Nada después de las cuatro de la tarde$$,$$Una siesta tardía se cobra directo de la hora de dormir. Despiértalo y aguanta la media hora de mal humor.$$,'es'),
  (48,2,'you',$$Revisa las condiciones de la guardería antes del año$$,$$Horarios, costos y salón cambian cerca del cumpleaños. Entérate antes de que llegue la carta.$$,'es'),
  (48,3,'play',$$El "¿dónde está?" se vuelve escondidas$$,$$Detrás de la puerta, mal escondida, obvia de encontrar. La misma lección, con más carreras.$$,'es'),
  (48,4,'care',$$Toallitas en la puerta del carro, no en la cajuela$$,$$Las necesitas donde vas sentada, no donde va el súper.$$,'es'),
  (48,5,'feed',$$Menos leche y más comida es la dirección$$,$$Puede parecer que la está rechazando. Casi siempre es solo el relevo pasando a tiempo.$$,'es'),
  (48,6,'sleep',$$Dale unos minutos a los ruiditos$$,$$A estas alturas casi siempre se está acomodando solo. Entrar decide por él.$$,'es'),

  (49,0,'play',$$Súbete a la obsesión$$,$$Ruedas, puertas, una cuchara en específico. En lo que esté clavado este mes es por donde está aprendiendo.$$,'es'),
  (49,1,'you',$$Encarga el pastel$$,$$Salvo que hornear sea tu parte divertida. Nadie en un primer cumpleaños está evaluando el pastel.$$,'es'),
  (49,2,'feed',$$La leche entera es un cambio a propósito$$,$$Tu pediatra te dice cuándo y cuánta para tu bebé. Planéalo en vez de hacerlo de un día para otro.$$,'es'),
  (49,3,'sleep',$$Separa los cambios grandes$$,$$Fiesta, cama nueva, leche nueva, quitar el biberón. En meses distintos, no en la misma semana.$$,'es'),
  (49,4,'care',$$Fotografía sus manos y sus pies$$,$$No solo la cara. Son lo que más cambia y la foto que nadie se acuerda de tomar.$$,'es'),
  (49,5,'play',$$Estar cerca de otros niños ya es la práctica$$,$$Todavía no juega con ellos. Uno al lado del otro es exactamente como se ve al año.$$,'es'),
  (49,6,'care',$$Sube lo chiquito antes de que lleguen las visitas$$,$$Las bolsas ajenas, los bolsillos de los abrigos y los listones de los regalos acaban a su altura.$$,'es'),

  (50,0,'you',$$Escribe lo único que te dirías a ti misma$$,$$Lo que sabes hoy y no sabías la primera semana. Para la próxima, o para quien te pregunte.$$,'es'),
  (50,1,'feed',$$Déjalo comer el pastel con las manos$$,$$Esa es la foto. Pon una sábana debajo de la silla y que sea un desastre.$$,'es'),
  (50,2,'sleep',$$Sostén la hora de dormir el día de la fiesta$$,$$Todo lo demás se puede mover. Ese ancla es lo que rescata la noche.$$,'es'),
  (50,3,'play',$$El papel de regalo le gana al regalo$$,$$Siempre. No te lo tomes personal y no compres más de un par de cosas.$$,'es'),
  (50,4,'care',$$Revisa otra vez la altura del colchón$$,$$Si se para y el barandal le queda al pecho, toca bajarlo más.$$,'es'),
  (50,5,'you',$$Pide el día del cumpleaños$$,$$Si puedes. Es más tu día que suyo, y lo vas a querer vivir en vez de organizarlo.$$,'es'),
  (50,6,'feed',$$Pedacito chico y expectativas bajas$$,$$A muchos bebés no les gusta su primer pastel. La foto sale buena de las dos maneras.$$,'es'),

  (51,0,'play',$$Dale un encargo$$,$$"Tráeme la pelota" llega antes que el "no". Llevarle algo a alguien es emocionante de verdad a esta edad.$$,'es'),
  (51,1,'care',$$Separa la ropa chica en tres montones$$,$$Guardar, regalar, tirar. Una vez por temporada evita que el cuarto extra se vuelva el pendiente.$$,'es'),
  (51,2,'sleep',$$Dos siestas al año cumplido es normal$$,$$El cambio suele venir entre los doce y los dieciocho meses. Que el bebé de alguien más ya lo hiciera no es tu señal.$$,'es'),
  (51,3,'feed',$$Cómete enfrente lo que él está rechazando$$,$$Tranquila y sin comentarios. Hace más que cualquier cantidad de insistencia.$$,'es'),
  (51,4,'you',$$Agenda la cita que ya moviste dos veces$$,$$Hazlo ahora, mientras estás lo bastante organizada como para estar leyendo esto.$$,'es'),
  (51,5,'play',$$Dale una bolsa con asa$$,$$Llenarla, cargarla, vaciarla, otra vez. Los contenedores portátiles son la obsesión del mes.$$,'es'),
  (51,6,'care',$$Las rejas se quedan después del cumpleaños$$,$$Trepa antes de lo que crees. Las escaleras son lo último en lo que hay que relajarse.$$,'es'),

  (52,0,'you',$$Sobreviviste el primer año$$,$$Se haya visto como se haya visto por dentro. Quédate un minuto ahí antes de empezar a planear el siguiente.$$,'es'),
  (52,1,'play',$$Hace cosas para hacerte reír$$,$$A propósito, y luego otra vez. Ahí empieza un tipo de relación completamente nuevo.$$,'es'),
  (52,2,'feed',$$Pasen de lleno a las comidas en familia$$,$$Una cena, todos en la mesa, su porción cortada chiquita. Es menos trabajo del que venías haciendo.$$,'es'),
  (52,3,'sleep',$$Los baches se van separando$$,$$No noches perfectas: más espacio entre una interrupción y la siguiente. Eso es lo que cambia después del año.$$,'es'),
  (52,4,'care',$$La primera visita al dentista por aquí$$,$$La recomendación es al año o cuando salga el primer diente. Es corta y es sobre todo para ti.$$,'es'),
  (52,5,'play',$$Empieza una caja del año$$,$$El brazalete del hospital, los primeros zapatos, una tarjeta. Una caja, todo el año, y vas a agradecer que exista.$$,'es'),
  (52,6,'you',$$Misma silla, foto número doce$$,$$La que empezaste en la semana cuatro. Las doce juntas son lo mejor que hiciste este año.$$,'es')
ON CONFLICT (week_number, day_index, locale) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body,
      category = EXCLUDED.category, updated_at = now()
  WHERE mom_tips.review_status = 'draft';

-- ── assert the whole set landed ─────────────────────────────────────────────
DO $verify$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM mom_tips WHERE locale = 'es';
  IF n <> 371 THEN
    RAISE EXCEPTION 'spanish set has % rows, expected 371', n;
  END IF;
  SELECT count(*) INTO n FROM mom_tips WHERE locale = 'es' AND review_status <> 'draft';
  IF n <> 0 THEN
    RAISE EXCEPTION '% spanish rows are not draft — nothing here may auto-publish', n;
  END IF;
END
$verify$;
