ALTER TABLE orders
ADD COLUMN driver_user_id UUID REFERENCES users(id),
ADD COLUMN assigned_driver_at TIMESTAMP WITH TIME ZONE;


