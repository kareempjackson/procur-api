-- Migration: Add Latin American countries
-- Date: 2026-04-07

INSERT INTO countries (code, name, country_code, currency, timezone, is_active) VALUES
  ('col', 'Colombia',    'CO', 'COP', 'America/Bogota',      false),
  ('pan', 'Panama',      'PA', 'PAB', 'America/Panama',      false),
  ('cri', 'Costa Rica',  'CR', 'CRC', 'America/Costa_Rica',  false),
  ('ecu', 'Ecuador',     'EC', 'USD', 'America/Guayaquil',   false),
  ('bra', 'Brazil',      'BR', 'BRL', 'America/Sao_Paulo',   false),
  ('chl', 'Chile',       'CL', 'CLP', 'America/Santiago',    false),
  ('per', 'Peru',        'PE', 'PEN', 'America/Lima',        false),
  ('mex', 'Mexico',      'MX', 'MXN', 'America/Mexico_City', false)
ON CONFLICT (code) DO NOTHING;
