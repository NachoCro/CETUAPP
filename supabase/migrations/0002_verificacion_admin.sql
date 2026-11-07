-- =============================================================================
-- Fase 1: ajustes para la verificación desde el panel del admin
-- =============================================================================

-- Una sola solicitud de verificación pendiente por usuario.
create unique index verification_requests_one_pending
  on verification_requests (user_id) where status = 'pendiente';

-- classify_users:
--   * p_member_type null = no cambiar el tipo (para rechazar/suspender en lote
--     una selección que mezcla alumnos y docentes).
--   * Si el usuario tenía una solicitud con certificado pendiente, se cierra
--     con el mismo resultado, para que no quede colgada en la cola.
create or replace function classify_users(
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

  update verification_requests
     set status      = p_status,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where user_id = any (p_user_ids)
     and status = 'pendiente'
     and p_status in ('verificado', 'rechazado');

  with changed as (
    update profiles p
       set member_type         = coalesce(p_member_type, p.member_type),
           verification_status = p_status,
           verification_method = case when p_status = 'verificado' then 'revision_admin'::verification_method
                                      else p.verification_method end,
           verified_at         = case when p_status = 'verificado' then coalesce(p.verified_at, now()) end
     where p.id = any (p_user_ids)
       and (p.verification_status, p.member_type)
           is distinct from (p_status, coalesce(p_member_type, p.member_type))
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

-- Un docente/no docente verificado que en realidad es alumno también puede
-- mandar su certificado para que lo reclasifiquen.
drop policy "verif: pedir" on verification_requests;
create policy "verif: pedir" on verification_requests for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pendiente' and reviewed_by is null
    and exists (
      select 1 from profiles
       where id = auth.uid()
         and (verification_status in ('pendiente', 'rechazado')
              or (verification_status = 'verificado' and member_type <> 'alumno'))
    )
  );

-- Al aprobar el certificado la cuenta pasa a alumno verificado (aunque ya
-- estuviera verificada como docente). Al rechazarlo, una cuenta ya verificada
-- no pierde su verificación.
create or replace function review_verification(p_request_id uuid, p_approve boolean, p_reason text default null)
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

  update profiles
     set verification_status = case
                                 when p_approve then 'verificado'
                                 when verification_status = 'verificado' then 'verificado'
                                 else 'rechazado'
                               end::verification_status,
         verification_method = case when p_approve then 'documento'::verification_method else verification_method end,
         verified_at         = case when p_approve then coalesce(verified_at, now()) else verified_at end,
         member_type         = case when p_approve then 'alumno'::member_type else member_type end
   where id = r.user_id;

  perform notify_user(
    r.user_id, 'verificacion',
    case when p_approve then 'Tu cuenta fue verificada como alumno/a' else 'No pudimos verificar tu certificado' end,
    case when p_approve then null else p_reason end
  );
end $$;
