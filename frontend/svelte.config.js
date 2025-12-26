// Use adapter-vercel for Vercel deployments (zero-config, works automatically)
// For other platforms (Docker, Netlify), use adapter-static
import adapter from '@sveltejs/adapter-vercel';
// import adapter from '@sveltejs/adapter-static'; // Uncomment for Docker/Netlify deployments
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use adapter-vercel for Vercel (zero-config, automatic)
		// For Docker/Netlify, uncomment adapter-static above and use:
		// adapter: adapter({
		//   pages: 'build',
		//   assets: 'build',
		//   fallback: 'index.html',
		//   precompress: false,
		//   strict: false
		// })
		adapter: adapter()
	}
};

export default config;
