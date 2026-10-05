import 'dotenv/config';
process.env.NODE_ENV ||= 'production';
await import('../dist/server/entry.mjs');
