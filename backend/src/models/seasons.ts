import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  productColors,
  products,
  productVariants,
  seasons,
} from '../db/schema.js'

export const findProductsForSeasonId = async (seasonId: string) => {
  return db.select().from(products).where(eq(products.seasonId, seasonId))
}

export const findSeasons = async () => {
  return db.select().from(seasons)
}
