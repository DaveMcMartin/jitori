import type { Handle } from '@sveltejs/kit';

let sqliteDb: any = null;

export const handle: Handle = async ({ event, resolve }) => {
	if (import.meta.env.DEV) {
		if (!sqliteDb) {
			const { default: Database } = await import('better-sqlite3');
			const fs = await import('fs');
			const path = await import('path');

			// Try to find the correct sqlite file based on the local d1 state
			const stateDir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
			let dbFile = null;
			if (fs.existsSync(stateDir)) {
				const files = fs.readdirSync(stateDir).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
				if (files.length > 0) {
					// We'll just grab the first one assuming it's the right local dev db
					dbFile = path.join(stateDir, files[0]);
				}
			}

			if (dbFile) {
				const sqlite = new Database(dbFile);

				// Mock D1 binding
				sqliteDb = {
					prepare(query: string) {
						const stmt = sqlite.prepare(query);
						return {
							bind(...args: any[]) {
								return {
									async all() {
										return { results: stmt.all(...args) };
									},
									async first() {
										return stmt.get(...args);
									},
									async run() {
										return stmt.run(...args);
									}
								};
							},
							async all() {
								return { results: stmt.all() };
							},
							async first() {
								return stmt.get();
							},
							async run() {
								return stmt.run();
							}
						};
					}
				};
			} else {
				console.warn('Could not find local SQLite database for development. Run `npx wrangler d1 migrations apply jitori --local`');
			}
		}

		if (sqliteDb) {
			event.platform = {
				...event.platform,
				env: {
					...event.platform?.env,
					DB: sqliteDb
				}
			} as any;
		}
	}

	return resolve(event);
};
