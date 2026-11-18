DELETE FROM product_photos WHERE product_id IN (
  'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10',
  'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20',
  'p21', 'p22', 'p23', 'p24', 'p25'
);
DELETE FROM products WHERE id IN (
  'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10',
  'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20',
  'p21', 'p22', 'p23', 'p24', 'p25'
);

INSERT INTO products (
  id, slug, name, price_cents, old_price_cents, stock, prep_days, description,
  fields, occasions, tag, size_classic, size_large, large_extra_cents, active, created_at
) VALUES
  ('p01', 'caja-vacia', 'Caja vacía', 3500, NULL, 0, 1, 'Caja de cartulina sin stock.', '[]', '["cumple"]', NULL, 'Clásica', 'Grande', 800, 1, '2026-11-18T12:00:00-05:00'),
  ('p02', 'taza-agotada', 'Taza agotada', 4200, NULL, 0, 2, 'Taza de cerámica, agotada.', '[]', '["aniversario"]', NULL, 'Clásica', 'Grande', 1000, 1, '2026-11-18T12:00:00-05:00'),
  ('p03', 'ramito-bajo', 'Ramito bajo', 4800, 5200, 2, 2, 'Ramito con pocas unidades.', '["color"]', '["mama"]', 'Oferta', 'Clásica', 'Grande', 1200, 1, '2026-11-18T12:00:00-05:00'),
  ('p04', 'vela-baja', 'Vela baja', 2800, NULL, 2, 1, 'Vela de soja, quedan dos.', '[]', '["bebe"]', NULL, 'Clásica', 'Grande', 600, 1, '2026-11-18T12:00:00-05:00'),
  ('p05', 'ramo-para-mama', 'Ramo para mamá 🌷', 8900, 9900, 8, 3, 'Rosas y claveles para mamá.', '["nombre","tarjeta"]', '["mama"]', 'Nuevo', 'Clásica', 'Grande', 1500, 1, '2026-11-18T12:00:00-05:00'),
  ('p06', 'desayuno-cumple', 'Desayuno de cumpleaños', 7500, NULL, 6, 2, 'Bandeja dulce para celebrar.', '["nombre"]', '["cumple","mama"]', NULL, 'Clásica', 'Grande', 1800, 1, '2026-11-18T12:00:00-05:00'),
  ('p07', 'anillo-fecha', 'Anillo de fecha', 12000, NULL, 5, 4, 'Anillo con la fecha grabada.', '[]', '["aniversario"]', NULL, 'Clásica', 'Grande', 2000, 1, '2026-11-18T12:00:00-05:00'),
  ('p08', 'caja-san-valentin', 'Caja de San Valentín', 9800, NULL, 7, 3, 'Chocolate y flores.', '["tarjeta"]', '["sanvalentin"]', 'Oferta', 'Clásica', 'Grande', 1500, 1, '2026-11-18T12:00:00-05:00'),
  ('p09', 'osito-bebe', 'Osito de bebé', 6400, NULL, 9, 2, 'Peluche suave para bebé.', '["color"]', '["bebe"]', NULL, 'Clásica', 'Grande', 900, 1, '2026-11-18T12:00:00-05:00'),
  ('p10', 'mix-flores', 'Mix de flores', 5600, NULL, 10, 2, 'Flores de estación.', '[]', '["cumple","aniversario"]', NULL, 'Clásica', 'Grande', 1400, 1, '2026-11-18T12:00:00-05:00'),
  ('p11', 'nandu-chocolate', 'Ñandú de chocolate', 4300, NULL, 8, 1, 'Chocolate con nombre propio.', '[]', '["cumple"]', NULL, 'Clásica', 'Grande', 700, 1, '2026-11-18T12:00:00-05:00'),
  ('p12', 'vela-mostaza', 'Vela mostaza', 3100, NULL, 11, 1, 'Vela de color mostaza.', '[]', '["mama"]', NULL, 'Clásica', 'Grande', 500, 1, '2026-11-18T12:00:00-05:00'),
  ('p13', 'marco-foto', 'Marco de foto', 5200, 6000, 4, 3, 'Marco de madera.', '["nombre"]', '["aniversario"]', NULL, 'Clásica', 'Grande', 1100, 1, '2026-11-18T12:00:00-05:00'),
  ('p14', 'taza-inicial', 'Taza con inicial', 3900, NULL, 8, 2, 'Taza personalizable.', '["nombre"]', '["cumple"]', NULL, 'Clásica', 'Grande', 800, 1, '2026-11-18T12:00:00-05:00'),
  ('p15', 'caja-te', 'Caja de té', 4700, NULL, 6, 2, 'Infusiones surtidas.', '[]', '["mama","aniversario"]', NULL, 'Clásica', 'Grande', 900, 1, '2026-11-18T12:00:00-05:00'),
  ('p16', 'ramo-rojo', 'Ramo rojo', 9100, NULL, 5, 3, 'Rosas rojas.', '["envoltura"]', '["sanvalentin","aniversario"]', NULL, 'Clásica', 'Grande', 1600, 1, '2026-11-18T12:00:00-05:00'),
  ('p17', 'movil-cuna', 'Móvil de cuna', 8600, NULL, 4, 4, 'Móvil de tela para la cuna.', '[]', '["bebe"]', 'Nuevo', 'Clásica', 'Grande', 1300, 1, '2026-11-18T12:00:00-05:00'),
  ('p18', 'libreta-nota', 'Libreta de nota', 2500, NULL, 12, 1, 'Libreta para una dedicatoria.', '["nombre"]', '["cumple"]', NULL, 'Clásica', 'Grande', 400, 1, '2026-11-18T12:00:00-05:00'),
  ('p19', 'difusor-oliva', 'Difusor oliva', 5400, NULL, 7, 2, 'Difusor de ambiente.', '[]', '["mama"]', NULL, 'Clásica', 'Grande', 1000, 1, '2026-11-18T12:00:00-05:00'),
  ('p20', 'plato-ceramica', 'Plato de cerámica', 6100, NULL, 9, 3, 'Plato hecho a mano.', '[]', '["aniversario"]', NULL, 'Clásica', 'Grande', 1200, 1, '2026-11-18T12:00:00-05:00'),
  ('p21', 'llavero-fecha', 'Llavero de fecha', 2200, NULL, 15, 1, 'Llavero con la fecha.', '["nombre"]', '["cumple"]', NULL, 'Clásica', 'Grande', 300, 1, '2026-11-18T12:00:00-05:00'),
  ('p22', 'ramo-mixto', 'Ramo mixto', 7300, NULL, 6, 2, 'Flores mixtas.', '["tarjeta","envoltura"]', '["mama","cumple"]', NULL, 'Clásica', 'Grande', 1500, 1, '2026-11-18T12:00:00-05:00'),
  ('p23', 'ramo-oculto', 'Ramo oculto', 5000, NULL, 5, 2, 'No se muestra en la tienda.', '[]', '["mama"]', NULL, 'Clásica', 'Grande', 1000, 0, '2026-11-18T12:00:00-05:00'),
  ('p24', 'taza-oculta', 'Taza oculta', 3000, NULL, 4, 1, 'No se muestra en la tienda.', '[]', '["cumple"]', NULL, 'Clásica', 'Grande', 700, 0, '2026-11-18T12:00:00-05:00'),
  ('p25', 'vela-oculta', 'Vela oculta', 2700, NULL, 6, 1, 'No se muestra en la tienda.', '[]', '["bebe"]', NULL, 'Clásica', 'Grande', 500, 0, '2026-11-18T12:00:00-05:00');

INSERT INTO product_photos (id, product_id, r2_key, position) VALUES
  ('ph-p01', 'p01', 'photos/caja-vacia.webp', 0),
  ('ph-p03-b', 'p03', 'photos/ramito-bajo-2.webp', 1),
  ('ph-p03-a', 'p03', 'photos/ramito-bajo-1.webp', 0),
  ('ph-p05-c', 'p05', 'photos/ramo-para-mama-3.webp', 2),
  ('ph-p05-a', 'p05', 'photos/ramo-para-mama-1.webp', 0),
  ('ph-p05-b', 'p05', 'photos/ramo-para-mama-2.webp', 1),
  ('ph-p06', 'p06', 'photos/desayuno-cumple.webp', 0),
  ('ph-p08', 'p08', 'photos/caja-san-valentin.webp', 0),
  ('ph-p11', 'p11', 'photos/nandu-chocolate.webp', 0),
  ('ph-p16', 'p16', 'photos/ramo-rojo.webp', 0),
  ('ph-p22', 'p22', 'photos/ramo-mixto.webp', 0),
  ('ph-p23', 'p23', 'photos/ramo-oculto.webp', 0);
