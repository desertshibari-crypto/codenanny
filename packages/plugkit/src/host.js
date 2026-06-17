import { EventEmitter } from 'node:events';

export function createHost({ app, db, logger = console } = {}) {
  if (!app) throw new Error('plugkit createHost: `app` (Express instance) is required');
  if (!db) throw new Error('plugkit createHost: `db` (sqlite handle) is required');

  const events = new EventEmitter();
  const modules = new Map();
  const navItems = [];

  function register(mod) {
    if (!mod?.name) throw new Error('plugkit: module must have a `name`');
    if (modules.has(mod.name)) throw new Error(`plugkit: module "${mod.name}" already registered`);

    if (mod.schema?.migrations?.length) {
      const tx = db.transaction(() => {
        for (const sql of mod.schema.migrations) db.exec(sql);
      });
      tx();
    }

    if (mod.router) {
      const router = mod.router({ db, events, logger, host });
      app.use(mod.mountPath || `/${mod.name}`, router);
    }

    if (mod.subscribe) {
      for (const [eventName, handler] of Object.entries(mod.subscribe)) {
        events.on(eventName, handler);
      }
    }

    if (mod.nav) {
      const items = Array.isArray(mod.nav) ? mod.nav : [mod.nav];
      navItems.push(...items.map((n) => ({ ...n, source: mod.name })));
    }

    modules.set(mod.name, mod);
    events.emit('module:registered', { name: mod.name });
    logger.info?.(`[plugkit] registered ${mod.name}`);
    return mod;
  }

  function getNav(user) {
    const role = user?.role || 'anon';
    let items = navItems.filter((item) => !item.roles || item.roles.includes(role));

    if (user?.nav_config) {
      const cfg = typeof user.nav_config === 'string' ? JSON.parse(user.nav_config) : user.nav_config;
      if (cfg.enabled) {
        const enabled = new Set(cfg.enabled);
        items = items.filter((i) => enabled.has(i.id));
      }
      if (cfg.order?.length) {
        const order = cfg.order;
        items.sort((a, b) => {
          const ai = order.indexOf(a.id);
          const bi = order.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
      }
    }

    return items;
  }

  function getModule(name) {
    return modules.get(name);
  }

  const host = { register, events, getNav, getModule, modules };
  return host;
}
