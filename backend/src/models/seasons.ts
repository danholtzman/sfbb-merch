import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { products as productsSchema, seasons } from '../db/schema.js'
import { getProductWithVariants } from './products.js'

export const getProductsForSeasonId = async (seasonId: string) => {
  const products = await db
    .select()
    .from(productsSchema)
    .where(eq(productsSchema.seasonId, seasonId))

  const productsWithVariantsPromises = products.map((product) => {
    return getProductWithVariants(product.id)
  })

  const productsWithVariants = await Promise.all(productsWithVariantsPromises)
  return productsWithVariants
}

export const getSeasons = async () => {
  return db.select().from(seasons)
}
