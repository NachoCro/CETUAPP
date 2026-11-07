import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Aplica todas las migraciones en orden y después seed.sql, sobre un Postgres en memoria
// con stubs mínimos de lo que provee Supabase (auth, storage, roles).
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'migrations');
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const db = new PGlite();

const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text,
  email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema storage to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
`;

let failures = 0;
const ok = (name, cond) => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const as = async (uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  if (uid) await db.exec('set role authenticated;');
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const fails = async (sql) => { try { await db.query(sql); return false; } catch { return true; } };

await db.exec(stubs);
for (const file of migrations) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  console.log(`Migración aplicada: ${file}`);
}
await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
console.log('Seed aplicado');

// --- usuarios ---
const U = { inst: '11111111-1111-1111-1111-111111111111', gmail: '22222222-2222-2222-2222-222222222222',
            admin: '33333333-3333-3333-3333-333333333333', foto: '44444444-4444-4444-4444-444444444444',
            comi: '55555555-5555-5555-5555-555555555555', doc: '66666666-6666-6666-6666-666666666666' };
await as(null);
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
   ('${U.inst}',  'ana@frsn.utn.edu.ar', '{"full_name":"Ana","dni":"30111222"}'),
   ('${U.doc}',   'profe@frsn.utn.edu.ar', '{"full_name":"Profe","member_type":"docente"}'),
   ('${U.gmail}', 'beto@gmail.com',              '{"full_name":"Beto"}'),
   ('${U.admin}', 'cetu@gmail.com',              '{"full_name":"Admin"}'),
   ('${U.foto}',  'foto@gmail.com',              '{"full_name":"Operador"}'),
   ('${U.comi}',  'comi@gmail.com',              '{"full_name":"Comisión"}');
  update auth.users set email_confirmed_at = now();
  insert into user_roles values ('${U.admin}', 'admin'), ('${U.foto}', 'fotocopiadora'), ('${U.comi}', 'comision');
  update profiles set verification_status = 'verificado' where id in ('${U.admin}', '${U.foto}', '${U.comi}');
`);
const st = async (id) => (await q(`select verification_status v from profiles where id=$1`, [id]))[0].v;
const prof = async (id) => (await q(`select * from profiles where id=$1`, [id]))[0];
ok('mail institucional NO verifica solo (lo usan docentes)', await st(U.inst) === 'pendiente');
ok('mail institucional queda marcado', (await prof(U.inst)).institutional_email === true);
ok('gmail no queda marcado como institucional', (await prof(U.gmail)).institutional_email === false);
ok('tipo declarado al registrarse', (await prof(U.doc)).member_type === 'docente' && (await prof(U.inst)).member_type === 'alumno');
ok('email copiado al perfil', (await prof(U.inst)).email === 'ana@frsn.utn.edu.ar');

// --- clasificación por el admin ---
await as(U.inst);
ok('alumno no puede clasificar usuarios', await fails(`select classify_users(array['${U.inst}']::uuid[], 'alumno', 'verificado')`));
ok('alumno no puede cambiar su tipo', await fails(`update profiles set member_type='alumno' where id='${U.inst}'`));
await as(U.admin);
const [{ classify_users: n }] = await q(`select classify_users(array['${U.inst}', '${U.doc}']::uuid[], 'alumno', 'verificado')`);
ok('admin verifica en lote → 2 cambios', n === 2);
await q(`select classify_users(array['${U.doc}']::uuid[], 'docente', 'verificado')`);
await as(null);
ok('alumno clasificado → verificado', await st(U.inst) === 'verificado');
ok('docente corregido por el admin', (await prof(U.doc)).member_type === 'docente');
await as(U.doc);
ok('docente verificado NO accede a funciones de alumno', await fails(`select * from create_claim(1, 'Prueba docente', 'x')`));
ok('docente recibe notificación', (await q(`select * from notifications`)).length >= 1);

// --- verificación manual ---
await as(U.gmail);
ok('alumno no puede autoverificarse', await fails(`update profiles set verification_status='verificado' where id='${U.gmail}'`));
await db.exec(`insert into verification_requests (user_id, document_path) values ('${U.gmail}', '${U.gmail}/cert.pdf')`);
ok('pendiente no puede votar ni reclamar', await fails(`select create_claim(1, 'Prueba pendiente', 'x')`));
await as(U.admin);
const [req] = await q(`select id from verification_requests`);
await q(`select review_verification($1, true)`, [req.id]);
await as(null);
ok('admin aprueba documento → verificado', await st(U.gmail) === 'verificado');

// --- reclamo anónimo ---
await as(U.inst);
const [claim] = await q(`select * from create_claim(1, 'Se llueve el aula 5', 'Gotera grande', true)`);
ok('código de seguimiento', /^REC-\d{4}-\d{4}$/.test(claim.tracking_code));
ok('autor ve su reclamo', (await q(`select * from claims`)).length === 1);
await as(U.admin);
ok('CETU ve el reclamo en la bandeja', (await q(`select * from claims_inbox`)).length === 1);
ok('CETU NO ve autor en bandeja', (await q(`select author_id from claims_inbox`))[0].author_id === null);
ok('CETU NO puede leer claim_authors', (await q(`select * from claim_authors`)).length === 0);
await db.exec(`update claims set status='elevado', escalated_to='Intendencia' where id='${claim.id}'`);
await db.exec(`insert into claim_messages (claim_id, sender, sender_id, body) values ('${claim.id}','cetu','${U.admin}','Lo elevamos')`);
await as(U.inst);
ok('autor recibe notificaciones de estado y respuesta', (await q(`select * from notifications where type like 'reclamo_%'`)).length === 2);
ok('alumno responde en el hilo', !(await fails(`insert into claim_messages (claim_id, sender, body) values ('${claim.id}','alumno','Gracias')`)));
await as(U.gmail);
ok('otro alumno no ve el reclamo', (await q(`select * from claims`)).length === 0);

// --- propuestas: umbral ---
await as(null);
await db.exec(`update app_settings set value='2' where key='proposal_vote_threshold'`);
await as(U.inst);
const [prop] = await q(`insert into proposals (author_id, title, body, status, vote_count) values ($1,'Más microondas','En el comedor','aprobada',999) returning *`, [U.inst]);
ok('propuesta arranca en votación con 0 votos', prop.status === 'en_votacion' && prop.vote_count === 0 && prop.expires_at);
await db.exec(`insert into proposal_votes values ('${prop.id}', '${U.inst}')`);
ok('voto duplicado rechazado', await fails(`insert into proposal_votes values ('${prop.id}', '${U.inst}')`));
await as(U.gmail);
await db.exec(`insert into proposal_votes values ('${prop.id}', '${U.gmail}')`);
await as(null);
const [p2] = await q(`select status, vote_count from proposals`);
ok('al llegar al umbral → elevada', p2.status === 'elevada' && p2.vote_count === 2);
ok('comisión notificada', (await q(`select * from notifications where user_id=$1 and type='propuesta_elevada'`, [U.comi])).length === 1);

// --- pedidos ---
await as(null); // service_role / Edge Function
const [ord] = await q(`insert into print_orders (user_id, file_path, page_count, copies, double_sided, color, binding, pickup_location_id, pickup_at, payment_method, total)
  values ($1, 'x/a.pdf', 10, 2, true, false, true, 1, now() + interval '1 day', 'al_retirar', 1) returning *`, [U.inst]);
ok(`total calculado en servidor (2*(10*50+1500)=4000) → ${ord.total}`, Number(ord.total) === 4000);
ok('código de pedido', /^PED-\d{5}$/.test(ord.code));
await as(U.inst);
ok('alumno no puede insertar pedidos directo', await fails(`insert into print_orders (user_id, file_path, page_count, copies, pickup_location_id, pickup_at, payment_method) values ('${U.inst}','a',1,1,1,now(),'online')`));
await as(U.foto);
ok('operador no puede cambiar el total', await fails(`update print_orders set total=1`));
await db.exec(`update print_orders set status='listo'`);
await as(U.inst);
ok('alumno notificado: pedido listo', (await q(`select * from notifications where type='pedido_listo'`)).length === 1);
ok('no puede cancelar un pedido listo', await fails(`select cancel_print_order('${ord.id}')`));

// --- apuntes ---
await as(null);
await as(U.inst);
const [note] = await q(`insert into notes (uploader_id, subject_id, title, description, file_path) values ($1, 1, 'Resumen de límites', 'Teoría y ejercicios de límites', 'x/l.pdf') returning id`, [U.inst]);
await db.exec(`insert into note_ratings values ('${note.id}', '${U.inst}', 4)`);
await as(U.gmail);
await db.exec(`insert into note_ratings values ('${note.id}', '${U.gmail}', 5)`);
await db.exec(`insert into note_reports (note_id, reporter_id, reason) values ('${note.id}', '${U.gmail}', 'contenido erróneo')`);
ok('rating promedio 4.5', Number((await q(`select rating_avg from notes`))[0].rating_avg) === 4.5);
ok('búsqueda en español', (await q(`select id from notes where search @@ plainto_tsquery('spanish', 'límite')`)).length === 1);
await as(U.admin);
ok('bandeja de reportes', Number((await q(`select pending_reports from note_reports_inbox`))[0].pending_reports) === 1);

// --- padrón ---
await as(null);
await db.exec(`insert into elections (title, voting_starts, voting_ends, published) values ('CETU 2026', now(), now() + interval '8 hours', true);
  insert into electoral_roll (election_id, dni, full_name, table_number, location) values (1, '30111222', 'Ana', '3', 'Aula Magna');`);
await as(U.inst);
ok('alumno consulta su padrón', (await q(`select * from my_roll_entry(1)`)).length === 1);
ok('alumno no lee el padrón completo', (await q(`select * from electoral_roll`)).length === 0);
ok('alumno no puede cambiar su DNI', await fails(`update profiles set dni='1' where id='${U.inst}'`));
await as(U.gmail);
ok('otro alumno no ve el registro ajeno', (await q(`select * from my_roll_entry(1)`)).length === 0);

// --- noticias ---
await as(U.inst);
ok('alumno no publica noticias', await fails(`insert into news_posts (category, title, body) values ('eventos','x','y')`));

console.log(failures ? `\n${failures} fallas` : '\nTodo OK');
process.exit(failures ? 1 : 0);
