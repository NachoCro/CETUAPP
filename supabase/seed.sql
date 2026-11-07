-- =============================================================================
-- Datos semilla para DESARROLLO. No aplicar en producción.
-- Carreras y materias de ejemplo: reemplazar por el plan de estudios real.
-- Usuarios de prueba: ver supabase/scripts/seed-users.mjs
-- =============================================================================

insert into careers (name) values
  ('Ingeniería en Sistemas de Información'),
  ('Ingeniería Electrónica'),
  ('Ingeniería Mecánica'),
  ('Ingeniería Civil'),
  ('Ingeniería Química');

insert into subjects (career_id, year, name)
select c.id, s.year, s.name
  from careers c
  join (values
    ('Ingeniería en Sistemas de Información', 1, 'Análisis Matemático I'),
    ('Ingeniería en Sistemas de Información', 1, 'Álgebra y Geometría Analítica'),
    ('Ingeniería en Sistemas de Información', 1, 'Algoritmos y Estructuras de Datos'),
    ('Ingeniería en Sistemas de Información', 1, 'Física I'),
    ('Ingeniería en Sistemas de Información', 2, 'Análisis Matemático II'),
    ('Ingeniería en Sistemas de Información', 2, 'Paradigmas de Programación'),
    ('Ingeniería en Sistemas de Información', 2, 'Sistemas Operativos'),
    ('Ingeniería en Sistemas de Información', 3, 'Bases de Datos'),
    ('Ingeniería en Sistemas de Información', 3, 'Redes de Datos'),
    ('Ingeniería Electrónica',                1, 'Análisis Matemático I'),
    ('Ingeniería Electrónica',                1, 'Física I'),
    ('Ingeniería Electrónica',                2, 'Electrotecnia'),
    ('Ingeniería Electrónica',                3, 'Electrónica Aplicada I'),
    ('Ingeniería Mecánica',                   1, 'Análisis Matemático I'),
    ('Ingeniería Mecánica',                   2, 'Estabilidad I'),
    ('Ingeniería Mecánica',                   3, 'Termodinámica'),
    ('Ingeniería Civil',                      1, 'Análisis Matemático I'),
    ('Ingeniería Civil',                      2, 'Estabilidad'),
    ('Ingeniería Civil',                      3, 'Hormigón I'),
    ('Ingeniería Química',                    1, 'Química General'),
    ('Ingeniería Química',                    2, 'Química Orgánica'),
    ('Ingeniería Química',                    3, 'Fisicoquímica')
  ) as s(career, year, name) on s.career = c.name;

insert into professors (full_name) values
  ('Laura Fernández'), ('Martín Gómez'), ('Carolina Ruiz'), ('Diego Sosa'), ('Valeria Pérez');

insert into subject_professors (subject_id, professor_id)
select s.id, p.id
  from subjects s
  join professors p on (s.id + p.id) % 3 = 0;   -- asignación arbitraria para tener datos

insert into print_schedule (location_id, weekday, opens, closes)
select l.id, d, '08:00', '21:00'
  from pickup_locations l, generate_series(1, 5) d
 where l.name like 'Fotocopiadora%';

insert into print_schedule (location_id, weekday, opens, closes)
select l.id, d, '10:00', '18:00'
  from pickup_locations l, generate_series(1, 5) d
 where l.name = 'Kiosco del centro de estudiantes';

insert into procedures (slug, title, summary, steps, requirements, office, schedule, published) values
  ('certificado-alumno-regular',
   'Certificado de alumno regular',
   'Constancia de que cursás en la facultad (para trabajo, becas, obra social, etc.).',
   E'1. Pedilo en el sistema de autogestión o en Bedelía.\n2. Retiralo en ventanilla con tu DNI.',
   'DNI.',
   'Bedelía (EJEMPLO: completar)',
   'Lunes a viernes de 9 a 18 (EJEMPLO: completar)',
   true);
