INSERT OR IGNORE INTO categories (id, name, color, defaultTaxDeductible, defaultBusinessType, isCustom, createdAt) VALUES
  ('cat_research',        'Research Materials',       'blue',   1, 'business', 0, datetime('now')),
  ('cat_travel',          'Travel',                   'indigo', 1, 'business', 0, datetime('now')),
  ('cat_prof_dev',        'Professional Development', 'purple', 1, 'business', 0, datetime('now')),
  ('cat_software',        'Software & Tools',         'cyan',   1, 'business', 0, datetime('now')),
  ('cat_marketing',       'Marketing & Promotion',    'pink',   1, 'business', 0, datetime('now')),
  ('cat_office',          'Office Supplies',          'green',  1, 'business', 0, datetime('now')),
  ('cat_equipment',       'Equipment & Hardware',     'orange', 1, 'business', 0, datetime('now')),
  ('cat_meals',           'Meals & Entertainment',    'yellow', 1, 'business', 0, datetime('now')),
  ('cat_prof_services',   'Professional Services',    'red',    1, 'business', 0, datetime('now')),
  ('cat_personal',        'Personal',                 'gray',   0, 'personal', 0, datetime('now'));
