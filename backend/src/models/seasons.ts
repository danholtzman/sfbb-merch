import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { products, seasons } from '../db/schema.js'

export const getProductsForSeasonId = async (seasonId: string) => {
  return db.select().from(products).where(eq(products.seasonId, seasonId))
}

export const getSeasons = async () => {
  return db.select().from(seasons)
}
