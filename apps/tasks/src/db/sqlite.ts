import Database from 'better-sqlite3';
import { logger } from '@bharat-agents/shared';
import path from 'path';
import type { JsonValue } from '@bharat-agents/shared';

// =============================================================================
// SQLite Database Adapter
// =============================================================================

export class SQLiteDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = 'local.db') {
    this.dbPath = path.resolve(process.cwd(), dbPath);
    this.db = new Database(this.dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create tables if they don't exist
    this.createTables();

    logger.info({ dbPath: this.dbPath }, 'SQLite database initialized');
  }

  private createTables(): void {
    // Create tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        data TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        status TEXT DEFAULT 'running',
        data TEXT, -- JSON string
        result TEXT, -- JSON string
        error TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
      )
    `);

    // Create agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create browser_agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS browser_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create flows table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create artifacts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT, -- JSON string or file path
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs (id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs (task_id);
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs (status);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs (started_at);
      CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts (run_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
    `);

    logger.info('SQLite tables created/verified');
  }

  // Task operations
  async createTask(task: {
    id: string;
    name: string;
    description?: string;
    status?: string;
    data?: JsonValue;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, name, description, status, data)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.name,
      task.description || null,
      task.status || 'pending',
      task.data ? JSON.stringify(task.data) : null
    );
  }

  async getTask(id: string): Promise<JsonValue | null> {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as unknown as {
      id: string;
      name: string;
      description?: string;
      status: string;
      data: string | null;
      created_at: string;
      updated_at: string;
    } | null;

    if (!row) return null;

    return {
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
    };
  }

  async updateTask(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      status: string;
      data: JsonValue;
    }>
  ): Promise<void> {
    const fields = Object.keys(updates).filter(
      key => updates[key as keyof typeof updates] !== undefined
    );

    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = updates[field as keyof typeof updates];
      return field === 'data' && value ? JSON.stringify(value) : value;
    });

    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(...values, id);
  }

  async listTasks(
    limit: number = 100,
    offset: number = 0
  ): Promise<JsonValue[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as Array<{
      id: string;
      name: string;
      description?: string;
      status: string;
      data: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
    }));
  }

  async deleteTask(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
  }

  // Run operations
  async createRun(run: {
    id: string;
    taskId: string;
    status?: string;
    data?: JsonValue;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO runs (id, task_id, status, data)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      run.id,
      run.taskId,
      run.status || 'running',
      run.data ? JSON.stringify(run.data) : null
    );
  }

  async getRun(id: string): Promise<JsonValue | null> {
    const stmt = this.db.prepare('SELECT * FROM runs WHERE id = ?');
    const row = stmt.get(id) as
      | (Omit<Record<string, unknown>, 'data' | 'result'> & {
          data: string | null;
          result: string | null;
        })
      | null;

    if (!row) return null;

    return {
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
      result: row.result ? JSON.parse(row.result) : null,
    };
  }

  async updateRun(
    id: string,
    updates: Partial<{
      status: string;
      data: JsonValue;
      result: JsonValue;
      error: string;
    }>
  ): Promise<void> {
    const fields = Object.keys(updates).filter(
      key => updates[key as keyof typeof updates] !== undefined
    );

    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = updates[field as keyof typeof updates];
      if (field === 'data' || field === 'result') {
        return value ? JSON.stringify(value) : null;
      }
      return value;
    });

    const stmt = this.db.prepare(`
      UPDATE runs 
      SET ${setClause}, completed_at = CASE WHEN ? = 'completed' OR ? = 'failed' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = ?
    `);

    const status = updates.status;
    stmt.run(...values, status, status, id);
  }

  async listRuns(
    taskId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<JsonValue[]> {
    let sql = 'SELECT * FROM runs';
    const params: unknown[] = [];

    if (taskId) {
      sql += ' WHERE task_id = ?';
      params.push(taskId);
    }

    sql += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<
      Omit<Record<string, unknown>, 'data' | 'result'> & {
        data: string | null;
        result: string | null;
      }
    >;

    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
      result: row.result ? JSON.parse(row.result) : null,
    }));
  }

  // Agent operations
  async createAgent(agent: {
    id: string;
    name: string;
    type: string;
    config?: JsonValue;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, name, type, config)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      agent.id,
      agent.name,
      agent.type,
      agent.config ? JSON.stringify(agent.config) : null
    );
  }

  async getAgent(id: string): Promise<JsonValue | null> {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(id) as
      | (Omit<Record<string, unknown>, 'config'> & { config: string | null })
      | null;

    if (!row) return null;

    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
    };
  }

  async listAgents(type?: string): Promise<JsonValue[]> {
    let sql = 'SELECT * FROM agents';
    const params: unknown[] = [];

    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<
      Omit<Record<string, unknown>, 'config'> & { config: string | null }
    >;

    return rows.map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
    }));
  }

  // Browser agent operations
  async createBrowserAgent(agent: {
    id: string;
    name: string;
    description?: string;
    config?: JsonValue;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO browser_agents (id, name, description, config)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      agent.id,
      agent.name,
      agent.description || null,
      agent.config ? JSON.stringify(agent.config) : null
    );
  }

  async getBrowserAgent(id: string): Promise<JsonValue | null> {
    const stmt = this.db.prepare('SELECT * FROM browser_agents WHERE id = ?');
    const row = stmt.get(id) as
      | (Omit<Record<string, unknown>, 'config'> & { config: string | null })
      | null;

    if (!row) return null;

    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
    };
  }

  async listBrowserAgents(): Promise<JsonValue[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM browser_agents ORDER BY created_at DESC'
    );
    const rows = stmt.all() as Array<
      Omit<Record<string, unknown>, 'config'> & { config: string | null }
    >;

    return rows.map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
    }));
  }

  // Flow operations
  async createFlow(flow: {
    id: string;
    name: string;
    description?: string;
    config?: JsonValue;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO flows (id, name, description, config)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      flow.id,
      flow.name,
      flow.description || null,
      flow.config ? JSON.stringify(flow.config) : null
    );
  }

  async getFlow(id: string): Promise<JsonValue | null> {
    const stmt = this.db.prepare('SELECT * FROM flows WHERE id = ?');
    const row = stmt.get(id) as
      | (Omit<Record<string, unknown>, 'config'> & { config: string | null })
      | null;

    if (!row) return null;

    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
    };
  }

  async listFlows(): Promise<JsonValue[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM flows ORDER BY created_at DESC'
    );
    const rows = stmt.all() as Array<
      Omit<Record<string, unknown>, 'config'> & { config: string | null }
    >;

    return rows.map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : null,
    }));
  }

  // Artifact operations
  async createArtifact(artifact: {
    id: string;
    runId: string;
    name: string;
    type: string;
    data?: JsonValue;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO artifacts (id, run_id, name, type, data)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      artifact.id,
      artifact.runId,
      artifact.name,
      artifact.type,
      artifact.data ? JSON.stringify(artifact.data) : null
    );
  }

  async getArtifact(id: string): Promise<JsonValue | null> {
    const stmt = this.db.prepare('SELECT * FROM artifacts WHERE id = ?');
    const row = stmt.get(id) as
      | (Omit<Record<string, unknown>, 'data'> & { data: string | null })
      | null;

    if (!row) return null;

    return {
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
    };
  }

  async listArtifacts(runId: string): Promise<JsonValue[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(runId) as Array<
      Omit<Record<string, unknown>, 'data'> & { data: string | null }
    >;

    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
    }));
  }

  // Utility methods
  async transaction<T>(fn: () => T): Promise<T> {
    return this.db.transaction(fn)();
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    error?: string;
  }> {
    try {
      // Simple query to test connection
      this.db.prepare('SELECT 1').get();
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Get database statistics
  getStats(): {
    tasks: number;
    runs: number;
    agents: number;
    browserAgents: number;
    flows: number;
    artifacts: number;
  } {
    const tasks = this.db
      .prepare('SELECT COUNT(*) as count FROM tasks')
      .get() as { count: number };
    const runs = this.db
      .prepare('SELECT COUNT(*) as count FROM runs')
      .get() as { count: number };
    const agents = this.db
      .prepare('SELECT COUNT(*) as count FROM agents')
      .get() as { count: number };
    const browserAgents = this.db
      .prepare('SELECT COUNT(*) as count FROM browser_agents')
      .get() as { count: number };
    const flows = this.db
      .prepare('SELECT COUNT(*) as count FROM flows')
      .get() as { count: number };
    const artifacts = this.db
      .prepare('SELECT COUNT(*) as count FROM artifacts')
      .get() as { count: number };

    return {
      tasks: tasks.count,
      runs: runs.count,
      agents: agents.count,
      browserAgents: browserAgents.count,
      flows: flows.count,
      artifacts: artifacts.count,
    };
  }
}

// Export singleton instance
export const sqliteDb = new SQLiteDatabase();
