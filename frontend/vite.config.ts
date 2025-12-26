import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
	// Note: The [404] errors you see for @react-refresh, main.tsx, etc.
	// are harmless - they're from browser extensions (React DevTools) looking
	// for React files. Since this is SvelteKit, these files don't exist.
	// These errors don't affect your app's functionality at all.
});
