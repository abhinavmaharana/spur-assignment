import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use adapter-static for Docker and static deployments
		// This ensures consistent build output regardless of deployment platform
		adapter: adapter({
			// Default options - pages are pre-rendered, fallback for SPA behavior
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // SPA mode - all routes fallback to index.html
			precompress: false,
			strict: false // Allow dynamic routes since this is a client-side SPA
		})
	}
};

export default config;
