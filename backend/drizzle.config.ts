import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { requireEnv } from './src/config/env'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: requireEnv('DATABASE_URL'),
  },
  schemaFilter: ['sfbb-merch'],
})
