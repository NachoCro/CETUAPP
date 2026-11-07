-- =============================================================================
-- CETU de bolsillo — esquema inicial
-- Ver docs/REQUERIMIENTOS.md. Pensado para Supabase (PostgreSQL 15+).
--
-- Convenciones:
--   * "alumno" es el rol base (todo usuario). Los roles extra van en user_roles.
--   * Toda tabla tiene RLS. Las políticas apuntan al rol `authenticated`.
--   * Lo que no debe hacer el cliente (crear pedidos, cobrar, hablar con la IA)
--     lo hacen Edge Functions con la service_role key, que saltea RLS.
--
-- Primer superadmin (una sola vez, desde el SQL editor de Supabase):
--   insert into user_roles (user_id, role) values ('<uuid>', 'superadmin');
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type app_role            as enum ('superadmin', 'admin', 'comision', 'fotocopiadora', 'comunicacion');
create type verification_status as enum ('pendiente', 'verificado', 'rechazado', 'suspendido');
create type verification_method as enum ('revision_admin', 'documento');
create type member_type         as enum ('alumno', 'docente', 'no_docente');
create type note_status         as enum ('visible', 'oculto', 'eliminado');
create type report_status       as enum ('pendiente', 'descartado', 'resuelto');
create type order_status        as enum ('recibido', 'imprimiendo', 'listo', 'retirado', 'cancelado');
create type payment_method      as enum ('online', 'al_retirar');
create type payment_status      as enum ('pendiente', 'pagado', 'reembolsado');
create type claim_status        as enum ('recibido', 'en_revision', 'elevado', 'resuelto', 'cerrado');
create type proposal_status     as enum ('en_votacion', 'elevada', 'aprobada', 'rechazada', 'en_ejecucion', 'archivada');
create type message_sender      as enum ('alumno', 'cetu');
create type chat_role           as enum ('user', 'assistant');
create type news_category       as enum ('elecciones', 'eventos', 'efemerides', 'memoria', 'institucional', 'urgente');
create type attendance_status   as enum ('interesa', 'voy');


-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;


-- -----------------------------------------------------------------------------
-- Configuración
-- -----------------------------------------------------------------------------
create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('institutional_email_domain',   '"frsn.utn.edu.ar"'),
  ('proposal_vote_threshold',      '50'),
  ('proposal_duration_days',       '60'),
  ('assistant_daily_message_limit','30');

create function setting_text(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value #>> '{}' from app_settings where key = p_key
$$;


-- -----------------------------------------------------------------------------
-- Cuentas, roles y verificación (RF-0)
-- -----------------------------------------------------------------------------
create table profiles (
  id                  uuid primary key references auth.users on delete cascade,
  full_name           text not null default '',
  email               text,                     -- copia de auth.users para la lista del admin
  dni                 text unique,
  legajo              text unique,
  -- Lo declara la persona al registrarse; el admin lo confirma o corrige.
  -- Docentes y no docentes también usan @frsn.utn.edu.ar, por eso el mail no alcanza.
  member_type         member_type not null default 'alumno',
  institutional_email boolean not null default false,   -- confirmó un mail del dominio institucional
  verification_status verification_status not null default 'pendiente',
  verification_method verification_method,
  verified_at         timestamptz,
  created_at          timestamptz not null default now()
);

create table user_roles (
  user_id    uuid not null references profiles on delete cascade,
  role       app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Helpers para políticas (security definer: no dependen del RLS de estas tablas)
create function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;

create function is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('superadmin')
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role('admin') or has_role('superadmin')
$$;

-- "Alumno verificado": habilita las funciones de estudiante (subir, votar, reclamar, pedir copias, padrón).
create function is_verified() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and verification_status = 'verificado' and member_type = 'alumno'
  )
$$;

create table verification_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles on delete cascade,
  document_path    text not null,                -- bucket "verificaciones"
  status           verification_status not null default 'pendiente',
  rejection_reason text,
  reviewed_by      uuid references profiles,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index on verification_requests (status, created_at);

-- Alta de perfil. El mail institucional NO verifica solo (lo usan también docentes
-- y no docentes): solo marca institutional_email para que el admin lo priorice.
create function handle_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domain text := lower(setting_text('institutional_email_domain'));
  v_type   member_type;
begin
  if tg_op = 'INSERT' then
    v_type := case new.raw_user_meta_data ->> 'member_type'
                when 'docente'    then 'docente'
                when 'no_docente' then 'no_docente'
                else 'alumno'
              end::member_type;
    insert into profiles (id, full_name, email, dni, legajo, member_type)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      new.email,
      nullif(trim(new.raw_user_meta_data ->> 'dni'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'legajo'), ''),
      v_type
    );
  end if;

  update profiles
     set email               = new.email,
         institutional_email = new.email_confirmed_at is not null
                               and v_domain is not null
                               and lower(split_part(new.email, '@', 2)) = v_domain
   where id = new.id;
  return new;
end $$;

create trigger on_auth_user
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function handle_auth_user();


-- -----------------------------------------------------------------------------
-- Catálogo académico
-- -----------------------------------------------------------------------------
create table careers (
  id   bigint generated always as identity primary key,
  name text not null unique
);

create table subjects (
  id        bigint generated always as identity primary key,
  career_id bigint not null references careers on delete cascade,
  year      smallint not null check (year between 1 and 7),
  name      text not null,
  unique (career_id, name)
);

create table professors (
  id        bigint generated always as identity primary key,
  full_name text not null
);

create table subject_professors (
  subject_id   bigint not null references subjects on delete cascade,
  professor_id bigint not null references professors on delete cascade,
  primary key (subject_id, professor_id)
);

create table profile_careers (
  user_id   uuid not null references profiles on delete cascade,
  career_id bigint not null references careers on delete cascade,
  year      smallint check (year between 1 and 7),
  primary key (user_id, career_id)
);


-- -----------------------------------------------------------------------------
-- Notificaciones (las usan varios módulos)
-- -----------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);

create table push_tokens (
  user_id    uuid not null references profiles on delete cascade,
  token      text not null,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

create function notify_user(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, data)
  select p_user, p_type, p_title, p_body, p_data where p_user is not null
$$;


-- -----------------------------------------------------------------------------
-- RPCs de verificación (el alumno no puede tocar su propio estado)
-- -----------------------------------------------------------------------------
create function review_verification(p_request_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r verification_requests;
begin
  if not is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into r from verification_requests where id = p_request_id for update;
  if not found then raise exception 'Solicitud inexistente'; end if;
  if r.status <> 'pendiente' then raise exception 'La solicitud ya fue revisada'; end if;

  update verification_requests
     set status           = case when p_approve then 'verificado' else 'rechazado' end::verification_status,
         rejection_reason = case when p_approve then null else p_reason end,
         reviewed_by      = auth.uid(),
         reviewed_at      = now()
   where id = p_request_id;

  -- El certificado de alumno regular prueba que es alumno.
  update profiles
     set verification_status = case when p_approve then 'verificado' else 'rechazado' end::verification_status,
         verification_method = case when p_approve then 'documento'::verification_method end,
         verified_at         = case when p_approve then now() end,
         member_type         = case when p_approve then 'alumno'::member_type else member_type end
   where id = r.user_id and verification_status <> 'verificado';

  perform notify_user(
    r.user_id, 'verificacion',
    case when p_approve then 'Tu cuenta fue verificada' else 'No pudimos verificar tu cuenta' end,
    case when p_approve then null else p_reason end
  );
end $$;

-- Lista de usuarios del admin: clasificar (alumno/docente/no docente) y verificar,
-- de a uno o en lote. Ej.: todos los pendientes con mail institucional que declaran ser alumnos.
create function classify_users(
  p_user_ids    uuid[],
  p_member_type member_type,
  p_status      verification_status
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with changed as (
    update profiles p
       set member_type         = p_member_type,
           verification_status = p_status,
           verification_method = case when p_status = 'verificado' then 'revision_admin'::verification_method
                                      else p.verification_method end,
           verified_at         = case when p_status = 'verificado' then coalesce(p.verified_at, now()) end
     where p.id = any (p_user_ids)
       and (p.verification_status, p.member_type) is distinct from (p_status, p_member_type)
    returning p.id, p.verification_status
  )
  select count(*) into v_count from (
    select notify_user(
             c.id, 'verificacion',
             case c.verification_status
               when 'verificado' then 'Tu cuenta fue verificada'
               when 'suspendido' then 'Tu cuenta fue suspendida'
               when 'rechazado'  then 'No pudimos verificar tu cuenta'
               else 'Tu cuenta cambió de estado'
             end,
             null)
      from changed c
  ) s;
  return v_count;
end $$;


-- -----------------------------------------------------------------------------
-- Apuntes (RF-1)
-- -----------------------------------------------------------------------------
create table notes (
  id           uuid primary key default gen_random_uuid(),
  uploader_id  uuid references profiles on delete set null,
  subject_id   bigint not null references subjects,
  professor_id bigint references professors,
  title        text not null check (char_length(title) between 3 and 160),
  description  text,
  file_path    text not null,                    -- bucket "apuntes"
  page_count   int check (page_count > 0),
  status       note_status not null default 'visible',
  rating_avg   numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  search       tsvector generated always as (
                 to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, ''))
               ) stored,
  created_at   timestamptz not null default now()
);
create index on notes using gin (search);
create index on notes (subject_id, status);
create index on notes (professor_id);

create table note_ratings (
  note_id    uuid not null references notes on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  score      smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create function refresh_note_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_note uuid := coalesce(new.note_id, old.note_id);
begin
  update notes
     set rating_avg   = coalesce((select avg(score) from note_ratings where note_id = v_note), 0),
         rating_count = (select count(*) from note_ratings where note_id = v_note)
   where id = v_note;
  return null;
end $$;

create trigger note_ratings_refresh
  after insert or update or delete on note_ratings
  for each row execute function refresh_note_rating();

create table note_reports (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references notes on delete cascade,
  reporter_id uuid not null references profiles on delete cascade,
  reason      text not null,                     -- ej: "contenido erróneo", "no corresponde", "derechos de autor"
  details     text,
  status      report_status not null default 'pendiente',
  resolved_by uuid references profiles,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (note_id, reporter_id)
);
create index on note_reports (status, created_at);

-- Bandeja de reportes agrupada por apunte (RF-1.9)
create view note_reports_inbox with (security_invoker = true) as
select n.id                                              as note_id,
       n.title,
       n.status                                          as note_status,
       count(*) filter (where r.status = 'pendiente')    as pending_reports,
       count(*)                                          as total_reports,
       max(r.created_at)                                 as last_report_at
  from notes n
  join note_reports r on r.note_id = n.id
 group by n.id;


-- -----------------------------------------------------------------------------
-- Fotocopiadora (RF-2)
-- -----------------------------------------------------------------------------
create table pickup_locations (
  id     bigint generated always as identity primary key,
  name   text not null unique,
  active boolean not null default true
);
insert into pickup_locations (name) values
  ('Fotocopiadora, planta baja'),
  ('Fotocopiadora, edificio nuevo'),
  ('Kiosco del centro de estudiantes');

-- Precio por carilla según color/faz, y anillado por copia. Valores de ejemplo: AJUSTAR.
create table print_prices (
  item        text primary key check (item in ('bn_simple', 'bn_doble_faz', 'color_simple', 'color_doble_faz', 'anillado')),
  price       numeric(10, 2) not null check (price >= 0),
  updated_at  timestamptz not null default now()
);
insert into print_prices (item, price) values
  ('bn_simple', 60), ('bn_doble_faz', 50), ('color_simple', 250), ('color_doble_faz', 220), ('anillado', 1500);

create table print_schedule (
  id          bigint generated always as identity primary key,
  location_id bigint not null references pickup_locations on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),   -- 0 = domingo
  opens       time not null,
  closes      time not null check (closes > opens)
);

create table print_closed_days (
  day    date primary key,
  reason text
);

create sequence print_order_code_seq;

create table print_orders (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique default 'PED-' || lpad(nextval('print_order_code_seq')::text, 5, '0'),
  user_id            uuid not null references profiles,
  file_path          text,                       -- bucket "pedidos"
  note_id            uuid references notes,      -- o un apunte de la biblioteca
  page_count         int not null check (page_count > 0),
  copies             int not null check (copies between 1 and 500),
  double_sided       boolean not null default false,
  color              boolean not null default false,
  binding            boolean not null default false,
  pickup_location_id bigint not null references pickup_locations,
  pickup_at          timestamptz not null,
  total              numeric(10, 2) not null default 0,
  status             order_status not null default 'recibido',
  payment_method     payment_method not null,
  payment_status     payment_status not null default 'pendiente',
  mp_payment_id      text,
  sent_to_printer_at timestamptz,                -- etapa 2: agente de impresión
  printed_by         uuid references profiles,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (file_path is not null or note_id is not null)
);
create index on print_orders (status, pickup_at);
create index on print_orders (user_id, created_at desc);

-- El total se calcula siempre en el servidor
create function compute_print_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_side numeric;
  v_bind numeric;
begin
  select price into v_side from print_prices
   where item = (case when new.color then 'color' else 'bn' end)
             || (case when new.double_sided then '_doble_faz' else '_simple' end);
  select price into v_bind from print_prices where item = 'anillado';
  if v_side is null then
    raise exception 'Falta configurar el precio de impresión';
  end if;
  new.total := new.copies * (new.page_count * v_side + case when new.binding then coalesce(v_bind, 0) else 0 end);
  return new;
end $$;

create trigger print_orders_total
  before insert or update of copies, page_count, color, double_sided, binding on print_orders
  for each row execute function compute_print_total();

create trigger print_orders_touch
  before update on print_orders
  for each row execute function touch_updated_at();

create table print_order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references print_orders on delete cascade,
  status     order_status not null,
  changed_by uuid references profiles,
  created_at timestamptz not null default now()
);

create function on_print_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into print_order_events (order_id, status, changed_by) values (new.id, new.status, auth.uid());
    if new.status = 'listo' then
      perform notify_user(new.user_id, 'pedido_listo', 'Tu pedido ' || new.code || ' está listo',
                          'Pasá a retirarlo.', jsonb_build_object('order_id', new.id));
    end if;
  end if;
  return null;
end $$;

create trigger print_orders_status
  after insert or update of status on print_orders
  for each row execute function on_print_order_status();

-- El alumno cancela su pedido mientras no se empezó a imprimir
create function cancel_print_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update print_orders set status = 'cancelado'
   where id = p_order_id and user_id = auth.uid() and status = 'recibido';
  if not found then
    raise exception 'El pedido no se puede cancelar';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- Reclamos (RF-3)
-- El autor vive en claim_authors, tabla que el CETU no puede leer:
-- así el anonimato no depende de que la app "oculte" un campo.
-- -----------------------------------------------------------------------------
create table claim_categories (
  id     bigint generated always as identity primary key,
  name   text not null unique,
  active boolean not null default true
);
insert into claim_categories (name) values
  ('Infraestructura'), ('Administrativo'), ('Cátedra'),
  ('Becas y beneficios'), ('Comedor y buffet'), ('Otro');

create sequence claim_code_seq;

create table claims (
  id            uuid primary key default gen_random_uuid(),
  tracking_code text not null unique
                default 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('claim_code_seq')::text, 4, '0'),
  category_id   bigint not null references claim_categories,
  title         text not null check (char_length(title) between 5 and 160),
  description   text not null,
  is_anonymous  boolean not null default false,
  status        claim_status not null default 'recibido',
  escalated_to  text,                            -- área de la facultad a la que se elevó
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on claims (status, created_at desc);
create index on claims (category_id);

create trigger claims_touch before update on claims
  for each row execute function touch_updated_at();

create table claim_authors (
  claim_id uuid primary key references claims on delete cascade,
  user_id  uuid not null references profiles on delete cascade
);
create index on claim_authors (user_id);

create function is_claim_author(p_claim uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from claim_authors where claim_id = p_claim and user_id = auth.uid())
$$;

create function claim_author_id(p_claim uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from claim_authors where claim_id = p_claim
$$;
revoke execute on function claim_author_id(uuid) from public;

create table claim_messages (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references claims on delete cascade,
  sender     message_sender not null,
  sender_id  uuid references profiles,           -- solo para mensajes del CETU
  body       text not null,
  created_at timestamptz not null default now(),
  check ((sender = 'alumno' and sender_id is null) or (sender = 'cetu' and sender_id is not null))
);
create index on claim_messages (claim_id, created_at);

create table claim_attachments (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references claims on delete cascade,
  message_id uuid references claim_messages on delete cascade,
  file_path  text not null,                      -- bucket "reclamos", carpeta = claim_id
  mime_type  text,
  sender     message_sender not null,
  created_at timestamptz not null default now()
);

-- Bitácora de gestión (RF-3.6)
create table claim_events (
  id          bigint generated always as identity primary key,
  claim_id    uuid not null references claims on delete cascade,
  status      claim_status,
  note        text,
  is_internal boolean not null default false,    -- notas internas del CETU, el alumno no las ve
  admin_id    uuid references profiles,
  created_at  timestamptz not null default now()
);
create index on claim_events (claim_id, created_at);

create function create_claim(
  p_category_id  bigint,
  p_title        text,
  p_description  text,
  p_is_anonymous boolean default false
) returns claims
language plpgsql security definer set search_path = public as $$
declare
  c claims;
begin
  if not is_verified() then
    raise exception 'Tu cuenta todavía no está verificada' using errcode = '42501';
  end if;
  insert into claims (category_id, title, description, is_anonymous)
  values (p_category_id, p_title, p_description, coalesce(p_is_anonymous, false))
  returning * into c;
  insert into claim_authors (claim_id, user_id) values (c.id, auth.uid());
  insert into claim_events (claim_id, status) values (c.id, 'recibido');
  return c;
end $$;

-- Cambio de estado: queda en la bitácora y se avisa al autor
create function on_claim_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into claim_events (claim_id, status, admin_id, note)
    values (new.id, new.status, auth.uid(),
            case when new.status = 'elevado' then new.escalated_to end);
    perform notify_user(claim_author_id(new.id), 'reclamo_estado',
                        'Tu reclamo ' || new.tracking_code || ' cambió de estado',
                        new.status::text, jsonb_build_object('claim_id', new.id));
  end if;
  return null;
end $$;

create trigger claims_status after update of status on claims
  for each row execute function on_claim_status();

create function on_claim_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender = 'cetu' then
    perform notify_user(claim_author_id(new.claim_id), 'reclamo_respuesta',
                        'El CETU respondió tu reclamo', left(new.body, 140),
                        jsonb_build_object('claim_id', new.claim_id));
  end if;
  return null;
end $$;

create trigger claim_messages_notify after insert on claim_messages
  for each row execute function on_claim_message();

-- Bandeja del CETU: el autor solo aparece si el reclamo NO es anónimo (RF-3.11)
create view claims_inbox as
select c.*,
       cat.name                                          as category_name,
       case when c.is_anonymous then null else p.id end        as author_id,
       case when c.is_anonymous then null else p.full_name end as author_name
  from claims c
  join claim_categories cat on cat.id = c.category_id
  left join claim_authors ca on ca.claim_id = c.id
  left join profiles p on p.id = ca.user_id
 where is_admin();
revoke all on claims_inbox from anon;


-- -----------------------------------------------------------------------------
-- Propuestas (RF-4)
-- -----------------------------------------------------------------------------
create table proposals (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid references profiles on delete set null,
  title               text not null check (char_length(title) between 5 and 140),
  body                text not null,
  category            text,
  status              proposal_status not null default 'en_votacion',
  vote_count          int not null default 0,
  elevated_at         timestamptz,
  expires_at          timestamptz,
  commission_response text,
  responded_by        uuid references profiles,
  responded_at        timestamptz,
  created_at          timestamptz not null default now()
);
create index on proposals (status, created_at desc);
create index on proposals (status, vote_count desc);

create function on_proposal_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.status      := 'en_votacion';
  new.vote_count  := 0;
  new.elevated_at := null;
  new.expires_at  := now() + make_interval(days => coalesce(setting_text('proposal_duration_days')::int, 60));
  return new;
end $$;

create trigger proposals_defaults before insert on proposals
  for each row execute function on_proposal_insert();

create table proposal_votes (
  proposal_id uuid not null references proposals on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

-- Recuenta votos y eleva automáticamente al llegar al umbral (RF-4.4 / 4.5)
create function on_proposal_vote() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id        uuid := coalesce(new.proposal_id, old.proposal_id);
  v_threshold int  := coalesce(setting_text('proposal_vote_threshold')::int, 50);
  p           proposals;
begin
  update proposals
     set vote_count = (select count(*) from proposal_votes where proposal_id = v_id)
   where id = v_id
  returning * into p;

  if p.status = 'en_votacion' and p.vote_count >= v_threshold then
    update proposals set status = 'elevada', elevated_at = now() where id = v_id;

    perform notify_user(ur.user_id, 'propuesta_elevada', 'Nueva propuesta elevada a la comisión',
                        p.title, jsonb_build_object('proposal_id', v_id))
       from user_roles ur where ur.role = 'comision';
    perform notify_user(p.author_id, 'propuesta_elevada', '¡Tu propuesta llegó a la comisión!',
                        p.title, jsonb_build_object('proposal_id', v_id));
  end if;
  return null;
end $$;

create trigger proposal_votes_count
  after insert or delete on proposal_votes
  for each row execute function on_proposal_vote();

-- Archivado de propuestas vencidas (RF-4.8). Activar pg_cron en Supabase y correr:
--   select cron.schedule('archivar-propuestas', '0 4 * * *', $$
--     update proposals set status = 'archivada'
--      where status = 'en_votacion' and expires_at < now() $$);


-- -----------------------------------------------------------------------------
-- Asistente de trámites (RF-5)
-- -----------------------------------------------------------------------------
create table procedures (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  summary      text,
  steps        text,                             -- markdown
  requirements text,                             -- documentación a llevar
  office       text,
  schedule     text,
  links        jsonb not null default '[]',
  published    boolean not null default false,
  updated_by   uuid references profiles,
  updated_at   timestamptz not null default now()
);
create trigger procedures_touch before update on procedures
  for each row execute function touch_updated_at();

create table assistant_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create table assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations on delete cascade,
  role            chat_role not null,
  content         text not null,
  created_at      timestamptz not null default now()
);
create index on assistant_messages (conversation_id, created_at);


-- -----------------------------------------------------------------------------
-- Noticias y eventos (RF-6)
-- -----------------------------------------------------------------------------
create table news_posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid references profiles on delete set null,
  category          news_category not null,
  title             text not null,
  body              text not null,
  cover_path        text,                        -- bucket público "noticias"
  links             jsonb not null default '[]',
  pinned            boolean not null default false,
  publish_at        timestamptz not null default now(),
  notify            boolean not null default true,
  target_career_ids bigint[],                    -- null = todas
  target_years      smallint[],                  -- null = todos
  notified_at       timestamptz,                 -- lo marca la Edge Function que envía
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on news_posts (publish_at desc);
create trigger news_posts_touch before update on news_posts
  for each row execute function touch_updated_at();

create table news_images (
  id         bigint generated always as identity primary key,
  post_id    uuid not null references news_posts on delete cascade,
  image_path text not null,
  caption    text,
  sort_order int not null default 0
);

create table events (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null unique references news_posts on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz,
  location  text
);
create index on events (starts_at);

create table event_attendance (
  event_id   uuid not null references events on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  status     attendance_status not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Categorías silenciadas por el alumno. Urgente y Elecciones no se pueden silenciar.
create table notification_preferences (
  user_id  uuid not null references profiles on delete cascade,
  category news_category not null check (category not in ('urgente', 'elecciones')),
  primary key (user_id, category)
);


-- -----------------------------------------------------------------------------
-- Elecciones (RF-6, solo informativo)
-- -----------------------------------------------------------------------------
create table elections (
  id                bigint generated always as identity primary key,
  title             text not null,
  description       text,
  voting_starts     timestamptz not null,
  voting_ends       timestamptz not null check (voting_ends > voting_starts),
  location          text,
  published         boolean not null default false,
  results           text,
  results_published boolean not null default false,
  created_at        timestamptz not null default now()
);

create table election_lists (
  id          bigint generated always as identity primary key,
  election_id bigint not null references elections on delete cascade,
  name        text not null,
  number      text,
  color       text,
  logo_path   text,                              -- bucket público "noticias"
  proposals   text,
  sort_order  int not null default 0
);

create table election_candidates (
  id         bigint generated always as identity primary key,
  list_id    bigint not null references election_lists on delete cascade,
  full_name  text not null,
  position   text not null,                      -- cargo al que se postula
  career     text,
  photo_path text,
  sort_order int not null default 0
);

-- Padrón importado por el CETU. Nadie lo lee directo salvo admins.
create table electoral_roll (
  id           bigint generated always as identity primary key,
  election_id  bigint not null references elections on delete cascade,
  dni          text,
  legajo       text,
  full_name    text not null,
  table_number text,                             -- mesa
  location     text,
  unique (election_id, dni),
  unique (election_id, legajo)
);

-- El alumno consulta solo su propio registro, por el DNI/legajo de su perfil.
-- El DNI/legajo se carga al registrarse y el alumno no puede cambiarlo después.
create function my_roll_entry(p_election_id bigint)
returns table (full_name text, table_number text, location text)
language sql stable security definer set search_path = public as $$
  select r.full_name, r.table_number, r.location
    from electoral_roll r
    join profiles p on p.id = auth.uid()
   where r.election_id = p_election_id
     and p.verification_status = 'verificado' and p.member_type = 'alumno'
     and ((p.dni is not null and r.dni = p.dni) or (p.legajo is not null and r.legajo = p.legajo))
$$;


-- =============================================================================
-- Permisos por columna
-- =============================================================================
-- El alumno solo puede cambiar su nombre (estado, DNI y legajo se cambian vía RPC/admin)
revoke update on profiles from anon, authenticated;
grant  update (full_name) on profiles to authenticated;

-- El operador solo cambia estado y pago, nunca el total
revoke update on print_orders from anon, authenticated;
grant  update (status, payment_status, sent_to_printer_at, printed_by) on print_orders to authenticated;

-- Nadie inserta pedidos ni mensajes del asistente desde el cliente (lo hacen Edge Functions)
revoke insert on print_orders, assistant_conversations, assistant_messages from anon, authenticated;


-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table app_settings             enable row level security;
alter table profiles                 enable row level security;
alter table user_roles               enable row level security;
alter table verification_requests    enable row level security;
alter table careers                  enable row level security;
alter table subjects                 enable row level security;
alter table professors               enable row level security;
alter table subject_professors       enable row level security;
alter table profile_careers          enable row level security;
alter table notifications            enable row level security;
alter table push_tokens              enable row level security;
alter table notes                    enable row level security;
alter table note_ratings             enable row level security;
alter table note_reports             enable row level security;
alter table pickup_locations         enable row level security;
alter table print_prices             enable row level security;
alter table print_schedule           enable row level security;
alter table print_closed_days        enable row level security;
alter table print_orders             enable row level security;
alter table print_order_events       enable row level security;
alter table claim_categories         enable row level security;
alter table claims                   enable row level security;
alter table claim_authors            enable row level security;
alter table claim_messages           enable row level security;
alter table claim_attachments        enable row level security;
alter table claim_events             enable row level security;
alter table proposals                enable row level security;
alter table proposal_votes           enable row level security;
alter table procedures               enable row level security;
alter table assistant_conversations  enable row level security;
alter table assistant_messages       enable row level security;
alter table news_posts               enable row level security;
alter table news_images              enable row level security;
alter table events                   enable row level security;
alter table event_attendance         enable row level security;
alter table notification_preferences enable row level security;
alter table elections                enable row level security;
alter table election_lists           enable row level security;
alter table election_candidates      enable row level security;
alter table electoral_roll           enable row level security;

-- Configuración ---------------------------------------------------------------
create policy "settings: leer"     on app_settings for select to authenticated using (true);
create policy "settings: admin"    on app_settings for all    to authenticated using (is_admin()) with check (is_admin());

-- Cuentas ---------------------------------------------------------------------
create policy "profiles: propio o admin" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy "profiles: editar propio" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "roles: propios o superadmin" on user_roles for select to authenticated
  using (user_id = auth.uid() or is_superadmin());
create policy "roles: superadmin asigna" on user_roles for insert to authenticated
  with check (is_superadmin());
create policy "roles: superadmin quita" on user_roles for delete to authenticated
  using (is_superadmin());

create policy "verif: propias o admin" on verification_requests for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "verif: pedir" on verification_requests for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pendiente' and reviewed_by is null
    and exists (select 1 from profiles where id = auth.uid() and verification_status in ('pendiente', 'rechazado'))
  );

-- Catálogo --------------------------------------------------------------------
create policy "careers: leer"  on careers  for select to authenticated using (true);
create policy "careers: admin" on careers  for all    to authenticated using (is_admin()) with check (is_admin());
create policy "subjects: leer"  on subjects for select to authenticated using (true);
create policy "subjects: admin" on subjects for all    to authenticated using (is_admin()) with check (is_admin());
create policy "professors: leer"  on professors for select to authenticated using (true);
create policy "professors: admin" on professors for all    to authenticated using (is_admin()) with check (is_admin());
create policy "subj_prof: leer"  on subject_professors for select to authenticated using (true);
create policy "subj_prof: admin" on subject_professors for all    to authenticated using (is_admin()) with check (is_admin());

create policy "profile_careers: propias" on profile_careers for all to authenticated
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid());

-- Notificaciones --------------------------------------------------------------
create policy "notif: propias" on notifications for select to authenticated using (user_id = auth.uid());
create policy "notif: marcar leída" on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif: borrar" on notifications for delete to authenticated using (user_id = auth.uid());

create policy "push: propios" on push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Apuntes ---------------------------------------------------------------------
create policy "notes: leer" on notes for select to authenticated
  using ((status = 'visible' and is_verified()) or uploader_id = auth.uid() or is_admin());
create policy "notes: subir" on notes for insert to authenticated
  with check (is_verified() and uploader_id = auth.uid() and status = 'visible'
              and rating_avg = 0 and rating_count = 0);
create policy "notes: moderar" on notes for update to authenticated
  using (is_admin()) with check (is_admin());
create policy "notes: borrar" on notes for delete to authenticated
  using (uploader_id = auth.uid() or is_admin());

create policy "ratings: leer" on note_ratings for select to authenticated using (is_verified());
create policy "ratings: calificar" on note_ratings for insert to authenticated
  with check (user_id = auth.uid() and is_verified());
create policy "ratings: cambiar" on note_ratings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ratings: quitar" on note_ratings for delete to authenticated using (user_id = auth.uid());

create policy "reports: propios o admin" on note_reports for select to authenticated
  using (reporter_id = auth.uid() or is_admin());
create policy "reports: reportar" on note_reports for insert to authenticated
  with check (reporter_id = auth.uid() and is_verified() and status = 'pendiente');
create policy "reports: resolver" on note_reports for update to authenticated
  using (is_admin()) with check (is_admin());

-- Fotocopiadora ---------------------------------------------------------------
create policy "pickup: leer"  on pickup_locations  for select to authenticated using (true);
create policy "pickup: admin" on pickup_locations  for all    to authenticated using (is_admin()) with check (is_admin());
create policy "prices: leer"  on print_prices      for select to authenticated using (true);
create policy "prices: admin" on print_prices      for all    to authenticated using (is_admin()) with check (is_admin());
create policy "sched: leer"   on print_schedule    for select to authenticated using (true);
create policy "sched: admin"  on print_schedule    for all    to authenticated using (is_admin()) with check (is_admin());
create policy "closed: leer"  on print_closed_days for select to authenticated using (true);
create policy "closed: admin" on print_closed_days for all    to authenticated using (is_admin()) with check (is_admin());

create policy "orders: propios u operador" on print_orders for select to authenticated
  using (user_id = auth.uid() or has_role('fotocopiadora') or is_admin());
create policy "orders: operador actualiza" on print_orders for update to authenticated
  using (has_role('fotocopiadora') or is_admin()) with check (has_role('fotocopiadora') or is_admin());

create policy "order_events: leer" on print_order_events for select to authenticated
  using (has_role('fotocopiadora') or is_admin()
         or exists (select 1 from print_orders o where o.id = order_id and o.user_id = auth.uid()));

-- Reclamos --------------------------------------------------------------------
create policy "claim_cat: leer"  on claim_categories for select to authenticated using (true);
create policy "claim_cat: admin" on claim_categories for all    to authenticated using (is_admin()) with check (is_admin());

-- Se crean solo con create_claim(); no hay política de insert directa.
create policy "claims: autor o cetu" on claims for select to authenticated
  using (is_claim_author(id) or is_admin());
create policy "claims: cetu gestiona" on claims for update to authenticated
  using (is_admin()) with check (is_admin());

-- Solo el propio autor (para "mis reclamos") y el superadmin ante abusos.
create policy "claim_authors: propio o superadmin" on claim_authors for select to authenticated
  using (user_id = auth.uid() or is_superadmin());

create policy "claim_msgs: leer" on claim_messages for select to authenticated
  using (is_claim_author(claim_id) or is_admin());
create policy "claim_msgs: alumno responde" on claim_messages for insert to authenticated
  with check (sender = 'alumno' and sender_id is null and is_claim_author(claim_id));
create policy "claim_msgs: cetu responde" on claim_messages for insert to authenticated
  with check (sender = 'cetu' and sender_id = auth.uid() and is_admin());

create policy "claim_att: leer" on claim_attachments for select to authenticated
  using (is_claim_author(claim_id) or is_admin());
create policy "claim_att: adjuntar" on claim_attachments for insert to authenticated
  with check ((sender = 'alumno' and is_claim_author(claim_id)) or (sender = 'cetu' and is_admin()));

create policy "claim_events: leer" on claim_events for select to authenticated
  using ((is_claim_author(claim_id) and not is_internal) or is_admin());
create policy "claim_events: cetu anota" on claim_events for insert to authenticated
  with check (is_admin() and admin_id = auth.uid());

-- Propuestas ------------------------------------------------------------------
create policy "proposals: leer" on proposals for select to authenticated using (true);
create policy "proposals: crear" on proposals for insert to authenticated
  with check (author_id = auth.uid() and is_verified());
create policy "proposals: comision/admin" on proposals for update to authenticated
  using (has_role('comision') or is_admin()) with check (has_role('comision') or is_admin());
create policy "proposals: moderar" on proposals for delete to authenticated using (is_admin());

create policy "votes: leer" on proposal_votes for select to authenticated using (true);
create policy "votes: votar" on proposal_votes for insert to authenticated
  with check (
    user_id = auth.uid() and is_verified()
    and exists (select 1 from proposals p where p.id = proposal_id and p.status in ('en_votacion', 'elevada'))
  );
create policy "votes: retirar" on proposal_votes for delete to authenticated using (user_id = auth.uid());

-- Asistente -------------------------------------------------------------------
create policy "procedures: leer" on procedures for select to authenticated using (published or is_admin());
create policy "procedures: admin" on procedures for all to authenticated using (is_admin()) with check (is_admin());

create policy "conv: propias" on assistant_conversations for select to authenticated using (user_id = auth.uid());
create policy "conv: borrar" on assistant_conversations for delete to authenticated using (user_id = auth.uid());
create policy "msgs: propios" on assistant_messages for select to authenticated
  using (exists (select 1 from assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- Noticias y eventos ----------------------------------------------------------
create policy "news: leer publicadas" on news_posts for select to authenticated
  using (publish_at <= now() or has_role('comunicacion'));
create policy "news: comunicacion" on news_posts for all to authenticated
  using (has_role('comunicacion')) with check (has_role('comunicacion'));

create policy "news_img: leer" on news_images for select to authenticated
  using (exists (select 1 from news_posts n where n.id = post_id));   -- hereda el RLS de news_posts
create policy "news_img: comunicacion" on news_images for all to authenticated
  using (has_role('comunicacion')) with check (has_role('comunicacion'));

create policy "events: leer" on events for select to authenticated
  using (exists (select 1 from news_posts n where n.id = post_id));
create policy "events: comunicacion" on events for all to authenticated
  using (has_role('comunicacion')) with check (has_role('comunicacion'));

create policy "attendance: leer" on event_attendance for select to authenticated using (true);
create policy "attendance: propia" on event_attendance for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notif_prefs: propias" on notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Elecciones ------------------------------------------------------------------
create policy "elections: leer" on elections for select to authenticated
  using (published or has_role('comunicacion'));
create policy "elections: comunicacion" on elections for all to authenticated
  using (has_role('comunicacion')) with check (has_role('comunicacion'));

create policy "lists: leer" on election_lists for select to authenticated
  using (exists (select 1 from elections e where e.id = election_id));
create policy "lists: comunicacion" on election_lists for all to authenticated
  using (has_role('comunicacion')) with check (has_role('comunicacion'));

create policy "candidates: leer" on election_candidates for select to authenticated
  using (exists (select 1 from election_lists l where l.id = list_id));
create policy "candidates: comunicacion" on election_candidates for all to authenticated
  using (has_role('comunicacion')) with check (has_role('comunicacion'));

create policy "roll: admin" on electoral_roll for all to authenticated
  using (is_admin()) with check (is_admin());


-- =============================================================================
-- Storage
-- Rutas: <bucket>/<carpeta>/<archivo>. La carpeta define quién accede.
-- =============================================================================
insert into storage.buckets (id, name, public) values
  ('noticias',       'noticias',       true),   -- imágenes de noticias, logos y fotos de listas
  ('apuntes',        'apuntes',        false),  -- carpeta = id del alumno que sube
  ('pedidos',        'pedidos',        false),  -- carpeta = id del alumno
  ('reclamos',       'reclamos',       false),  -- carpeta = id del reclamo
  ('verificaciones', 'verificaciones', false);  -- carpeta = id del alumno

create policy "st noticias: comunicacion sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'noticias' and public.has_role('comunicacion'));
create policy "st noticias: comunicacion edita" on storage.objects for update to authenticated
  using (bucket_id = 'noticias' and public.has_role('comunicacion'));
create policy "st noticias: comunicacion borra" on storage.objects for delete to authenticated
  using (bucket_id = 'noticias' and public.has_role('comunicacion'));

create policy "st apuntes: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'apuntes' and public.is_verified()
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "st apuntes: leer" on storage.objects for select to authenticated
  using (bucket_id = 'apuntes'
         and (public.is_verified() or public.is_admin() or public.has_role('fotocopiadora')));
create policy "st apuntes: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'apuntes'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "st pedidos: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'pedidos' and public.is_verified()
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "st pedidos: leer" on storage.objects for select to authenticated
  using (bucket_id = 'pedidos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.has_role('fotocopiadora') or public.is_admin()));

create policy "st reclamos: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'reclamos'
              and (public.is_claim_author(((storage.foldername(name))[1])::uuid) or public.is_admin()));
create policy "st reclamos: leer" on storage.objects for select to authenticated
  using (bucket_id = 'reclamos'
         and (public.is_claim_author(((storage.foldername(name))[1])::uuid) or public.is_admin()));

create policy "st verif: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'verificaciones' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "st verif: leer" on storage.objects for select to authenticated
  using (bucket_id = 'verificaciones'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- =============================================================================
-- Realtime: panel de la fotocopiadora, notificaciones y chat de reclamos
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table print_orders, notifications, claim_messages;
  end if;
end $$;
