// Crea usuarios de prueba (uno por rol) en el proyecto de Supabase de DESARROLLO.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node supabase/scripts/seed-users.mjs
//
// La service_role key saltea RLS: no la commitees ni la uses en la app.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (serviceKey.startsWith('sb_publishable_') || serviceKey === '...') {
  console.error(
    'Esa es la publishable key (o un texto de ejemplo). Hace falta la SECRET key (sb_secret_...) o la\n' +
      'service_role legacy (eyJ...): Supabase → Project Settings → API Keys.',
  );
  process.exit(1);
}

const PASSWORD = 'cetu-prueba-123';
const USERS = [
  { email: 'superadmin@prueba.cetu', name: 'Super Admin',      dni: '90000001', roles: ['superadmin'] },
  { email: 'admin@prueba.cetu',      name: 'Admin CETU',       dni: '90000002', roles: ['admin'] },
  { email: 'comunicacion@prueba.cetu', name: 'Prensa CETU',    dni: '90000003', roles: ['admin', 'comunicacion'] },
  { email: 'foto@prueba.cetu',       name: 'Operador Fotocopiadora', dni: '90000004', roles: ['fotocopiadora'] },
  { email: 'comision@prueba.cetu',   name: 'Comisión Directiva', dni: '90000005', roles: ['comision'] },
  { email: 'alumno@prueba.cetu',     name: 'Alumna Verificada', dni: '90000006', roles: [] },
  { email: 'pendiente@prueba.cetu',  name: 'Alumno Pendiente',  dni: '90000007', roles: [], pending: true },
];

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

for (const u of USERS) {
  const { data, error } = await db.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.name, dni: u.dni },
  });
  if (error) {
    console.log(`= ${u.email}: ${error.message}`);
    continue;
  }
  const id = data.user.id;
  if (!u.pending) {
    await db.from('profiles').update({ verification_status: 'verificado', verified_at: new Date().toISOString() }).eq('id', id);
  }
  if (u.roles.length) {
    await db.from('user_roles').insert(u.roles.map((role) => ({ user_id: id, role })));
  }
  console.log(`+ ${u.email} ${u.roles.join(', ') || '(alumno)'}${u.pending ? ' [pendiente]' : ''}`);
}

console.log(`\nContraseña de todos: ${PASSWORD}`);
