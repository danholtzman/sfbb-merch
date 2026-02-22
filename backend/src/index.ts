import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import express from 'express'
import postgres from 'postgres'
import { requireEnv } from './config/env.js'
import { usersTable } from './db/schema.js'

const client = postgres(requireEnv('DATABASE_URL'))
export const db = drizzle({ client, casing: 'snake_case' })

const app = express()
app.use(express.json())

const PORT = 3000

app.get('/users', async (req, res) => {
  const users = await db.select().from(usersTable)
  res.json(users)
})

app.post('/users', async (req, res) => {
  const user: typeof usersTable.$inferInsert = {
    name: req.body.name,
    age: req.body.age,
    email: req.body.email,
  }
  await db.insert(usersTable).values(user)

  const users = await db.select().from(usersTable)
  res.json(users)
})

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})
