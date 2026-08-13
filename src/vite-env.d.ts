/// <reference types="vite/client" />

declare module 'mirador' {
	export const viewer: (config: Record<string, unknown>, plugins?: unknown[]) => unknown;
}
