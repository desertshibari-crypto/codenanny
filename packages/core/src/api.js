export function createApi(db) {
  return {
    sessions: {
      list({ limit = 100, project_id = null } = {}) {
        if (project_id) {
          return db.prepare(`
            SELECT * FROM sessions WHERE project_id = ? ORDER BY ended_at DESC LIMIT ?
          `).all(project_id, limit);
        }
        return db.prepare(`SELECT * FROM sessions ORDER BY ended_at DESC LIMIT ?`).all(limit);
      },
      get(id) {
        return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
      },
      prompts(id) {
        return db.prepare(`
          SELECT * FROM session_prompts WHERE session_id = ? ORDER BY ts ASC
        `).all(id);
      },
      files(id) {
        return db.prepare(`
          SELECT * FROM session_files WHERE session_id = ? ORDER BY ts ASC
        `).all(id);
      },
    },
    files: {
      byProject(projectId) {
        return db.prepare(`
          SELECT f.*, s.title AS session_title FROM session_files f
          JOIN sessions s ON s.id = f.session_id
          WHERE s.project_id = ?
          ORDER BY f.ts DESC
        `).all(projectId);
      },
      recent(limit = 100) {
        return db.prepare(`
          SELECT f.*, s.title AS session_title FROM session_files f
          JOIN sessions s ON s.id = f.session_id
          ORDER BY f.ts DESC LIMIT ?
        `).all(limit);
      },
    },
    projects: {
      list() {
        return db.prepare(`SELECT * FROM projects ORDER BY name`).all();
      },
    },
    search(query, { limit = 50 } = {}) {
      try {
        return db.prepare(`
          SELECT session_id, ts, role, snippet(session_prompts_fts, 3, '<mark>', '</mark>', '...', 32) AS snippet
          FROM session_prompts_fts
          WHERE session_prompts_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `).all(query, limit);
      } catch {
        const like = `%${query}%`;
        return db.prepare(`
          SELECT session_id, ts, role, text AS snippet
          FROM session_prompts
          WHERE text LIKE ?
          ORDER BY ts DESC
          LIMIT ?
        `).all(like, limit);
      }
    },
    stats() {
      const sessions = db.prepare(`SELECT COUNT(*) AS c FROM sessions`).get().c;
      const files = db.prepare(`SELECT COUNT(*) AS c FROM session_files`).get().c;
      const projects = db.prepare(`SELECT COUNT(*) AS c FROM projects`).get().c;
      const prompts = db.prepare(`SELECT COUNT(*) AS c FROM session_prompts`).get().c;
      return { sessions, files, projects, prompts };
    },
  };
}
