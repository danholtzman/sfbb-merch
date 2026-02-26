import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { requireEnv } from '../config/env.js'
import * as schema from './schema.js'

const client = postgres(requireEnv('DATABASE_URL'))
export const db = drizzle({ client, schema, casing: 'snake_case' })
