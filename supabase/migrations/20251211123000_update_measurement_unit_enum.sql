-- Update measurement_unit enum to match API MeasurementUnit values
-- Adds 'bag' and 'bucket' if they don't already exist.

ALTER TYPE measurement_unit ADD VALUE IF NOT EXISTS 'bag';
ALTER TYPE measurement_unit ADD VALUE IF NOT EXISTS 'bucket';


