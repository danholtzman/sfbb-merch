import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { productVariants } from '../db/schema.js'

export const getVariantsForProduct = async (productId: string) => {
  return db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
}
