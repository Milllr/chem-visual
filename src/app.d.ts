/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				BUCKET: R2Bucket;
				OPENAI_API_KEY: string;
				PERPLEXITY_API_KEY: string;
				AUTH_PASSWORD_HASH: string;
				AUTH_SECRET: string;
			};
		}
		interface Locals {
			authenticated: boolean;
		}
	}
}

export {};
