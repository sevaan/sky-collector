// Sky Collector's plane relay on Deno Deploy (2026-11-15; Val Town is shutting down, Cloudflare sign-in fails for Sevaan).
// Deploy: dash.deno.com → New project → this repo, entrypoint relay/deno-planes.ts. Locally: deno run -N relay/deno-planes.ts
import handler from './planes.ts';

Deno.serve(handler);
