# CETU de bolsillo — Requerimientos

App del Centro de Estudiantes, **independiente de la facultad** (sin integración oficial), para **una sola facultad**.
Administrada por el CETU y el equipo de desarrollo. Disponible como **web y app móvil** (Android / iOS).

## Stack

| Capa | Tecnología |
|---|---|
| Web + apps | React Native + **Expo** (Expo Router), TypeScript |
| Backend | **Supabase**: PostgreSQL, Auth, Storage, Realtime, Edge Functions |
| Pagos | **Mercado Pago** (Checkout Pro + webhooks), cuenta del CETU |
| IA | **API de Claude** desde una Edge Function |
| Notificaciones | Expo Push + email (Resend) |

## Roles

| Rol | Quién | Puede |
|---|---|---|
| Superadmin | Equipo de desarrollo | Configuración general, asignar roles, ver autor de reclamos anónimos solo ante abuso |
| Admin CETU | Miembros del CETU | Verificar alumnos, catálogo, trámites, moderación, reclamos, precios |
| Comisión directiva | Comisión del CETU | Responder propuestas elevadas |
| Comunicación | Uno o más admins del CETU (asignado por el superadmin) | Publicar noticias, eventos y elecciones; enviar notificaciones masivas |
| Operador fotocopiadora | Personal del CETU | Panel de pedidos y cobros |
| Alumno verificado | Estudiantes | Todos los módulos |
| Alumno pendiente | Recién registrado | Solo lectura de contenido público |

Un usuario puede tener varios roles.

---

## RF-0. Cuentas y verificación
- RF-0.1 Registro con email/contraseña o Google.
- RF-0.2 Perfil: nombre, DNI/legajo, carrera(s) y año.
- RF-0.3 Al registrarse, la persona declara si es **alumno/a, docente o no docente**.
- RF-0.3b El mail institucional (`@frsn.utn.edu.ar`, configurable) **no verifica solo**, porque también lo usan docentes y no docentes: marca la cuenta como "mail institucional confirmado" para que el admin la priorice.
- RF-0.3c **Lista de usuarios del admin** con filtros (tipo declarado, mail institucional, estado) para **clasificar y verificar**, de a uno o en lote.
- RF-0.3d Solo los **alumnos verificados** acceden a las funciones de estudiante (subir, votar, reclamar, pedir copias, padrón). Docentes y no docentes ven noticias y contenido.
- RF-0.4 **Verificación con certificado** (alternativa): el alumno sube certificado de alumno regular; un admin aprueba o rechaza con motivo.
- RF-0.5 Estados de cuenta: Pendiente → Verificado / Rechazado, y Suspendido.
- RF-0.6 Panel de admin con cola de verificaciones.
- RF-0.7 Un alumno pendiente no puede subir, votar, reclamar ni pedir copias.
- RF-0.8 Superadmin asigna/quita roles.
- RF-0.9 Catálogo de carreras, años, materias y profesores administrado por el CETU.

## RF-1. Apuntes
- RF-1.1 Biblioteca por carrera → año → materia.
- RF-1.2 Subir PDF con materia, profesor (opcional), título y descripción.
- RF-1.3 Búsqueda por materia, profesor y texto.
- RF-1.4 Ver y descargar.
- RF-1.5 Calificar 1–5 (un voto por alumno, modificable); se muestra el promedio.
- RF-1.6 Reportar con motivo (un reporte por alumno por apunte).
- RF-1.7 Los reportes van a una **bandeja del admin**; el apunte sigue visible hasta que el admin decide.
- RF-1.8 Acciones del admin: descartar reporte, ocultar o eliminar apunte (con aviso opcional al autor).
- RF-1.9 La bandeja agrupa por apunte y muestra la cantidad de reportes.
- RF-1.10 Baja por reclamo de derechos de autor.

## RF-2. Fotocopiadora (del CETU)
- RF-2.1 Pedido subiendo un PDF o eligiendo un apunte de la biblioteca.
- RF-2.2 Opciones: copias, simple/doble faz, color, anillado.
- RF-2.3 Punto de retiro (configurable) y día/franja horaria dentro de los horarios cargados.
- RF-2.4 Precio calculado en el servidor según la lista de precios del CETU.
- RF-2.5 Pago online (Mercado Pago) o al retirar.
- RF-2.6 Panel del operador: cola de pedidos ordenada por horario de retiro.
- RF-2.7 Estados: Recibido → Imprimiendo → Listo → Retirado, y Cancelado.
- RF-2.8 Notificación al alumno cuando el pedido está Listo.
- RF-2.9 Registro de pago (pendiente/pagado), incluido cobro en efectivo.
- RF-2.10 Admin configura precios, puntos de retiro, horarios y días cerrados.
- RF-2.11 Reporte de pedidos e ingresos por período.
- RF-2.12 **Impresión manual (etapa 1)**: el panel muestra la configuración del pedido bien visible; botón "Imprimir" abre el PDF para imprimir desde la PC; botón "Hoja de retiro" imprime una carátula con código, nombre y punto de retiro.
- RF-2.13 **Agente de impresión para Windows (etapa 2)**: programa en la PC de la fotocopiadora que, cuando el operador aprueba el pedido ("Enviar a la impresora"), lo imprime automáticamente con la configuración correcta (SumatraPDF) y actualiza el estado.

## RF-3. Reclamos
- RF-3.1 Formulario: categoría, título, descripción.
- RF-3.2 Adjuntos (fotos y archivos).
- RF-3.3 Número de seguimiento único (`REC-2026-0042`).
- RF-3.4 Estados: Recibido → En revisión → Elevado → Resuelto / Cerrado.
- RF-3.5 Hilo de mensajes alumno ↔ CETU.
- RF-3.6 El CETU registra a qué área se elevó, la gestión realizada y la respuesta.
- RF-3.7 Exportar a PDF para presentación formal.
- RF-3.8 Bandeja del CETU con filtros por categoría, estado y fecha.
- RF-3.9 Aviso: el reclamo lo gestiona el CETU, no es una presentación oficial.
- RF-3.10 Opción **"Enviar como anónimo"**.
- RF-3.11 En reclamos anónimos el CETU no ve el autor (ni en bandeja, ni en mensajes, ni en el PDF).
- RF-3.12 El sistema guarda el autor internamente para seguimiento y respuestas; solo el superadmin accede ante abusos.
- RF-3.13 Se advierte que el anonimato puede limitar la gestión.

## RF-4. Propuestas
- RF-4.1 Cualquier alumno verificado crea propuestas.
- RF-4.2 Voto a favor, uno por alumno (se puede retirar).
- RF-4.3 Lista pública de todas las propuestas.
- RF-4.4 **Umbral de votos configurable** (ej. 50).
- RF-4.5 Al alcanzar el umbral se **eleva automáticamente** a la comisión y se notifica a comisión y autor.
- RF-4.6 Las elevadas se **destacan**: insignia y sección propia arriba de la lista.
- RF-4.7 Las menos votadas no se opacan: orden por defecto "recientes", barra de progreso hacia el umbral, orden "cerca del umbral", filtros por categoría.
- RF-4.8 Vigencia configurable (ej. 60 días); sin alcanzar el umbral se archiva.
- RF-4.9 Estados: En votación → Elevada → Aprobada / Rechazada / En ejecución, y Archivada.
- RF-4.10 La comisión publica una respuesta en cada propuesta elevada.
- RF-4.11 Moderación de duplicadas o inapropiadas.

## RF-5. Asistente de trámites con IA
- RF-5.1 Chat en lenguaje natural.
- RF-5.2 Explica pasos, documentación, a dónde ir y horarios.
- RF-5.3 Redacta notas o reclamos formales dirigidos a la autoridad que corresponda.
- RF-5.4 Responde en base a la **base de trámites cargada por el CETU**.
- RF-5.5 Panel del CETU para crear/editar trámites.
- RF-5.6 Copiar o descargar la nota en PDF.
- RF-5.7 Convertir la redacción en un reclamo (RF-3).
- RF-5.8 Aviso de información no oficial.
- RF-5.9 Si el trámite no está en la base, lo dice en lugar de inventar.
- RF-5.10 Límite diario de mensajes por alumno (configurable).

## RF-6. Noticias, eventos y elecciones

### Rol Comunicación
- RF-6.0 Solo usuarios con rol **Comunicación** publican y envían notificaciones masivas. Lo asigna el superadmin a uno o más admins del CETU (recomendado: una persona).

### Noticias
- RF-6.1 Sección **Noticias**: título, texto, imagen/flyer, galería de fotos y links.
- RF-6.2 Categorías: Elecciones, Eventos, Efemérides, Memoria, Institucional, Urgente.
- RF-6.3 Fijar publicaciones arriba y programar fecha/hora de publicación.
- RF-6.4 Al publicar, notificación push y/o email: a todos o segmentada por carrera y año.
- RF-6.5 Urgente y Elecciones siempre se notifican; el resto el alumno puede silenciarlo por categoría.
- RF-6.6 Estadísticas básicas: alcance y aperturas.

### Eventos
- RF-6.7 Una noticia puede ser un **evento** con fecha, hora y lugar.
- RF-6.8 "Me interesa / Voy" y "Agregar a mi calendario".
- RF-6.9 Recordatorio automático el día anterior.
- RF-6.10 Vista de próximos eventos.

### Elecciones (solo informativo, no se vota en la app)
- RF-6.11 Fecha, horario y lugar de votación.
- RF-6.12 **Listas que se presentan**: nombre, número/color, logo, propuestas y **candidatos** (nombre, cargo, carrera, foto opcional).
- RF-6.13 Todas las listas se muestran con el mismo espacio y formato.
- RF-6.14 El CETU **importa el padrón** (CSV/Excel); el alumno consulta si figura y dónde vota.
- RF-6.15 Recordatorios antes y el día de la elección.
- RF-6.16 (opcional) Publicación de resultados.

---

## Requerimientos no funcionales
- **Plataforma**: web + Android + iOS desde un solo código, en español.
- **Seguridad**: permisos por rol con Row Level Security; documentos de verificación y reclamos solo visibles para el alumno y el CETU.
- **Privacidad**: política propia; documentos de verificación con retención limitada.
- **Archivos**: solo PDF e imágenes; máximo 50 MB por PDF.
- **Pagos**: Mercado Pago a nombre del CETU; confirmación por webhook (nunca desde el cliente).
- **Notificaciones**: push y/o email.
- **Legal**: aviso de app no oficial; términos de uso; política de derechos de autor.
- **IA**: límite de uso para controlar costos; claves de API solo en el servidor.
- **Instancia única**: una sola facultad.
- **Neutralidad electoral**: en período electoral, las noticias y notificaciones oficiales no promocionan a ninguna lista (regla a definir por el CETU).
- **Padrón**: datos personales de acceso restringido; cada alumno solo consulta su propio registro.

---

## Para más adelante
- **Memoria**: sección permanente con cada baldosa de estudiantes desaparecidos durante la dictadura (nombre, carrera, historia, foto, ubicación en la facultad). Mientras tanto se publica como noticia con categoría Memoria.
