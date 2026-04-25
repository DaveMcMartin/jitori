// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				AUDIO_BUCKET: R2Bucket;
				PUBLIC_AUDIO_BASE_URL?: string;
			};
			context: any;
			caches: any;
			cf: any;
		}
	}
}

export {};
