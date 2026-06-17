export function defineModule(def) {
  if (!def?.name) throw new Error('plugkit defineModule: `name` is required');
  if (typeof def.name !== 'string') throw new Error('plugkit defineModule: `name` must be a string');
  return def;
}
