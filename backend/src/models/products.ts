import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { products, productVariants } from '../db/schema.js'

export const getVariantsForProduct = async (productId: string) => {
  return db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
}

export const getProductWithVariants = async (productId: string) => {
  const variants = await getVariantsForProduct(productId)

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return {
    ...product[0],
    variants,
  }
}
