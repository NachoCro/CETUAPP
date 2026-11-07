# CETU de bolsillo

App del Centro de Estudiantes (web + Android + iOS): apuntes, fotocopiadora, reclamos, propuestas,
asistente de trámites con IA, noticias y elecciones. Independiente de la facultad.

Requerimientos completos: [`docs/REQUERIMIENTOS.md`](docs/REQUERIMIENTOS.md).

## Estructura

```
docs/REQUERIMIENTOS.md          Requerimientos funcionales y no funcionales
supabase/migrations/            Esquema de la base de datos, permisos (RLS) y storage
supabase/seed.sql               Datos de ejemplo para desarrollo
supabase/scripts/               Usuarios de prueba (uno por rol)
supabase/tests/                 Tests del esquema (Postgres en memoria, sin Docker)
docs/PLAN.md                    Plan de desarrollo por fases
.github/workflows/ci.yml        Chequeos automáticos en cada push/PR
app/                            App Expo (React Native + Expo Router, TypeScript)
  src/app/                      Pantallas (cada archivo es una ruta)
    (auth)/                     Login y registro
    (tabs)/                     Inicio, Apuntes, Copias, Reclamos, Más (+ Propuestas, Asistente, Elecciones)
    admin.tsx, comunicacion.tsx, fotocopiadora.tsx, comision.tsx   Paneles por rol
  src/lib/                      Cliente de Supabase y sesión/roles (auth.tsx)
  src/components/ui.tsx         Componentes base (Screen, Card, Button, Field…)
Centro de estudiantes_ prototipo de la app.html   Prototipo visual original
```

## Puesta en marcha

### 1. Base de datos (Supabase)
1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Aplicar la migración: con la CLI (`npx supabase link --project-ref <id>` y `npx supabase db push`)
   o pegando `supabase/migrations/0001_schema.sql` en el SQL Editor.
3. El dominio institucional ya viene configurado (`frsn.utn.edu.ar`); se puede cambiar en `app_settings`.
4. **Solo en desarrollo**: cargar `supabase/seed.sql` (catálogo de ejemplo) y crear un usuario de prueba
   por rol (contraseña `cetu-prueba-123`):
   ```bash
   cd supabase && npm install
   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run seed:users
   ```
5. **En producción**: registrarse en la app y darse el primer rol de superadmin desde el SQL Editor:
   ```sql
   insert into user_roles (user_id, role) values ('<uuid del usuario>', 'superadmin');
   ```

### 2. App
```bash
cd app
cp .env.example .env.local   # completar URL y publishable key de Supabase
npm install
npx expo start               # w = web, a = Android, i = iOS (o escanear el QR con Expo Go)
```

### Tests del esquema
Aplican todas las migraciones + `seed.sql` en un Postgres en memoria (no hace falta Docker) y prueban los permisos.
```bash
cd supabase
npm install
npm test
```

## Roles
| Rol | Qué habilita |
|---|---|
| (alumno) | Todo usuario. Verificado: sube, vota, reclama y pide copias |
| `admin` | Panel del CETU: verificaciones, moderación, reclamos, trámites, precios, padrón |
| `superadmin` | Todo lo anterior + asignar roles |
| `comunicacion` | Noticias, eventos, elecciones y notificaciones masivas |
| `fotocopiadora` | Cola de pedidos |
| `comision` | Responder propuestas elevadas |

La seguridad real está en las políticas RLS de la base: los guards de la app solo ordenan la navegación.

## Próximos pasos
Implementar los módulos de a uno (pantallas reales + Edge Functions): pedidos con Mercado Pago,
asistente con Claude, push, envío programado de noticias e importador del padrón.
