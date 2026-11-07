# Plan de desarrollo — CETU de bolsillo

Orden pensado por dependencias: primero lo que usan todos los módulos, después los módulos que no
dependen de servicios externos, y al final los que necesitan Mercado Pago, la IA o publicar en tiendas.

Tamaño relativo: **S** (chico), **M** (mediano), **L** (grande).

---

## Fase 0 — Fundaciones (M)
Lo necesitan todos los módulos. Nada de esto se ve en la app, pero ahorra trabajo después.

- [x] Repo git único en la raíz (borrar `app/.git`), `.gitignore`, ramas `main` + ramas por módulo.
- [x] CI con GitHub Actions: `tsc`, `expo lint` y tests del esquema en cada PR (`.github/workflows/ci.yml`).
- [ ] Proyecto de Supabase **de desarrollo**; aplicar `0001_schema.sql`; dominio institucional real. *(lo crea el equipo)*
- [ ] Generar tipos: `supabase gen types` → `app/src/lib/database.types.ts` y tipar el cliente. *(requiere el proyecto)*
- [x] Datos semilla: `supabase/seed.sql` (catálogo de ejemplo, horarios, un trámite) y
      `supabase/scripts/seed-users.mjs` (un usuario de prueba por rol).
- [x] Capa de datos: **TanStack Query** (`app/src/lib/query.ts`).
- [x] Componentes comunes: `list-state.tsx`, `chips.tsx`, `status-badge.tsx`, subida a Storage y selectores
      de archivo/fotos (`app/src/lib/storage.ts`). *Sin barra de progreso: supabase-js no la expone; se muestra spinner.*
- [x] Bandeja de **notificaciones dentro de la app** con campanita y tiempo real (`app/src/app/notificaciones.tsx`).

**Listo cuando:** un usuario de prueba de cada rol entra a la app y ve sus paneles; CI en verde.

---

## Fase 1 — Cuentas y administración base (M)
Sin esto nadie puede hacer nada más que mirar.

- [ ] Panel admin: **lista de usuarios** con filtros (alumno/docente/no docente declarado, mail institucional,
      estado) y acciones en lote con `classify_users` (ej. "verificar a todos los pendientes con mail
      institucional que declaran ser alumnos").
- [ ] Verificación con certificado: subir certificado → `verification_requests`; ver estado y motivo de rechazo.
- [ ] Panel admin: cola de verificaciones con vista del documento, aprobar/rechazar (`review_verification`).
- [ ] Perfil: carrera(s) y año (`profile_careers`).
- [ ] Superadmin: buscar usuarios y asignar/quitar roles.
- [ ] Admin: ABM de carreras, materias y profesores.
- [ ] Admin: configuración (`app_settings`): umbral de votos, vigencia, dominio, límite del asistente.

**Listo cuando:** un alumno con mail institucional se verifica desde la lista en lote; un docente queda
clasificado como docente sin funciones de estudiante; un alumno con Gmail sube su certificado y lo aprueban.

---

## Fase 2 — Apuntes (M)
- [ ] Navegación carrera → año → materia; búsqueda por texto (`search`) y filtro por profesor.
- [ ] Subir PDF (máx. 50 MB) con materia, profesor, título y descripción.
- [ ] Detalle: ver/descargar, calificar 1–5, promedio.
- [ ] Reportar con motivo.
- [ ] Panel admin: bandeja de reportes (`note_reports_inbox`): descartar, ocultar, eliminar.

**Listo cuando:** se sube, se encuentra, se califica y se modera un apunte de punta a punta.

---

## Fase 3 — Reclamos (M)
- [ ] Nuevo reclamo (`create_claim`): categoría, descripción, fotos/adjuntos, opción anónima con aviso.
- [ ] Mis reclamos: código de seguimiento, estado, línea de tiempo (`claim_events`).
- [ ] Chat del reclamo en tiempo real (Realtime sobre `claim_messages`).
- [ ] Panel CETU: bandeja (`claims_inbox`) con filtros, cambiar estado, "elevado a…", notas internas.
- [ ] Exportar reclamo a PDF (puede quedar para la Fase 9).

**Listo cuando:** un reclamo anónimo va y vuelve entre alumno y CETU sin que el CETU vea el autor.

---

## Fase 4 — Propuestas (S)
- [ ] Lista: sección destacada de elevadas + lista general por recientes, con barra de progreso al umbral.
- [ ] Orden por recientes / más votadas / cerca del umbral; filtro por categoría.
- [ ] Votar y retirar voto; nueva propuesta.
- [ ] Panel comisión: propuestas elevadas, responder y cambiar estado.
- [ ] Activar `pg_cron` para archivar propuestas vencidas.

**Listo cuando:** una propuesta llega al umbral, se destaca y la comisión la responde.

---

## Fase 5 — Notificaciones push + Noticias y eventos (L)
Va acá porque a partir de ahora casi todo necesita avisar al celular.

- [ ] Push: `expo-notifications`, registrar token en `push_tokens`.
- [ ] Edge Function `send-push`: se dispara con un Database Webhook al insertar en `notifications`.
- [ ] Preferencias: silenciar categorías (`notification_preferences`).
- [ ] Inicio: noticias fijadas + feed por categoría + galería.
- [ ] Eventos: próximos, "Me interesa / Voy", agregar al calendario, recordatorio el día anterior.
- [ ] Panel Comunicación: crear/editar noticias con imagen, programar, segmentar por carrera/año.
- [ ] Edge Function programada: publicar y notificar noticias con `publish_at` futuro.

**Listo cuando:** Comunicación publica un evento segmentado y les llega el push solo a esos alumnos.

---

## Fase 6 — Fotocopiadora (L)
- [ ] Admin: precios, puntos de retiro, horarios, días cerrados.
- [ ] Edge Function `create-order`: valida el PDF, cuenta páginas, valida horario de retiro e inserta.
- [ ] Pantalla Copias: archivo o apunte, opciones, precio estimado, retiro, forma de pago.
- [ ] Mis pedidos con estado en tiempo real.
- [ ] Panel fotocopiadora: cola en tiempo real, botones **Imprimir** y **Hoja de retiro**, estados, cobro.
- [ ] Mercado Pago: Edge Function de checkout + webhook que marca `pagado` (nunca desde el cliente).
- [ ] Reporte de pedidos e ingresos por período.

**Listo cuando:** un pedido pagado online pasa de recibido a retirado y el alumno recibe el aviso de "listo".

---

## Fase 7 — Asistente de trámites con IA (M)
- [ ] Panel admin: ABM de trámites (`procedures`) y publicar/despublicar.
- [ ] Edge Function `assistant`: arma el contexto con los trámites publicados, llama a la API de Claude,
      guarda la conversación, aplica el límite diario y responde en streaming.
- [ ] Pantalla de chat con historial y aviso de "información no oficial".
- [ ] Redacción de notas: copiar, descargar PDF, "convertir en reclamo" (precarga Fase 3).
- [ ] Batería de preguntas de prueba (trámites cargados, no cargados, pedidos fuera de tema).

**Listo cuando:** pregunta por un trámite cargado → pasos correctos; por uno no cargado → lo dice y no inventa.

---

## Fase 8 — Elecciones (S)
- [ ] Panel Comunicación: elección, listas (logo, color, propuestas) y candidatos.
- [ ] Panel admin: importar padrón desde CSV/Excel con vista previa y validación.
- [ ] Pantalla Elecciones: info, listas con el mismo formato, "¿Dónde voto?" (`my_roll_entry`).
- [ ] Recordatorios automáticos; publicación de resultados (opcional).

**Listo cuando:** un alumno del padrón ve su mesa y uno que no está recibe un mensaje claro.

---

## Fase 9 — Pulido y lanzamiento (M)
- [ ] Login con Google; recuperar contraseña.
- [ ] Términos de uso, política de privacidad, aviso de app no oficial, política de derechos de autor.
- [ ] Accesibilidad básica (tamaños, contraste, lectores de pantalla) y revisión en celulares reales.
- [ ] Proyecto de Supabase **de producción**, backups, monitoreo de errores (Sentry).
- [ ] Web publicada (EAS Hosting o similar); builds con EAS; Play Store y App Store.
- [ ] Beta cerrada con un grupo de estudiantes antes de abrir a todos.

---

## Después del lanzamiento
- Agente de impresión para Windows (RF-2.13).
- Sección Memoria con las baldosas.
- Estadísticas para el CETU (alcance de noticias, reclamos por categoría, pedidos).

---

## Cómo se trabaja cada módulo
1. Si el módulo necesita cambios en la base: **nueva migración** (`0002_...sql`), nunca editar la 0001
   una vez aplicada; agregar sus casos a `supabase/tests/schema.test.mjs`.
2. Regenerar tipos.
3. Pantallas del alumno → panel del rol que lo gestiona → notificaciones.
4. Antes del PR: `npx tsc --noEmit`, `npx expo lint`, tests del esquema, y probarlo en web **y** en un celular.
5. Marcar los RF cumplidos en `docs/REQUERIMIENTOS.md`.

## Paralelizable
Con más de una persona: después de las Fases 0 y 1, las Fases 2, 3 y 4 son independientes entre sí.
La 6 y la 7 también se pueden hacer en paralelo una vez que esté el push (Fase 5).
