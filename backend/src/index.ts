import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import express from 'express'
import postgres from 'postgres'
import { requireEnv } from './config/env.js'

const client = postgres(requireEnv('DATABASE_URL'))
export const db = drizzle({ client, casing: 'snake_case' })

const app = express()
app.use(express.json())
