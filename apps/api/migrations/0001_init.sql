CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  old_price_cents INTEGER,
  stock INTEGER NOT NULL CHECK (stock >= 0),
  prep_days INTEGER NOT NULL CHECK (prep_days BETWEEN 0 AND 30),
  description TEXT NOT NULL,
  fields TEXT NOT NULL, -- JSON array
  occasions TEXT NOT NULL, -- JSON array
  tag TEXT,
  size_classic TEXT NOT NULL,
  size_large TEXT NOT NULL,
  large_extra_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX products_active ON products(active, id);

CREATE TABLE product_photos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE (product_id, position)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- código = REG-{año}-{id con 4 dígitos}
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('por_verificar', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'rechazado')),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('estacion', 'delivery')),
  station TEXT,
  slot TEXT,
  address TEXT,
  district TEXT,
  reference TEXT,
  delivery_date TEXT NOT NULL,
  note TEXT,
  subtotal_cents INTEGER NOT NULL,
  delivery_cost_cents INTEGER,
  yape_operation TEXT NOT NULL,
  capture_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  delivered_at TEXT,
  rejected_at TEXT
);

CREATE INDEX orders_status ON orders(status, id);
CREATE INDEX orders_upcoming ON orders(status, delivery_date);
CREATE INDEX orders_created ON orders(created_at);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 20),
  unit_price_cents INTEGER NOT NULL,
  options TEXT NOT NULL -- JSON: size, name, color, card, wrap
);

CREATE INDEX order_items_order ON order_items(order_id);
