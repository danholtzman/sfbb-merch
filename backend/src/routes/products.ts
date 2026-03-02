import { Router } from 'express'
import {
  getProductWithVariants,
  getVariantsForProduct,
} from '../models/products.js'

export const productsRouter: Router = Router()

productsRouter.get('/:productId', async (req, res) => {
  const { productId } = req.params

  try {
    const product = await getProductWithVariants(productId)
    res.json(product)
  } catch (_error) {
    res.status(404).json({ error: 'No variants found for this product' })
  }
})

productsRouter.get('/:productId/variants', async (req, res) => {
  const { productId } = req.params

  try {
    const variants = await getVariantsForProduct(productId)
    res.json(variants)
  } catch (_error) {
    res.status(404).json({ error: 'No variants found for this product' })
  }
})
