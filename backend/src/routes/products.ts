import { Router } from 'express'
import { getVariantsForProduct } from '../models/products.js'

export const productsRouter: Router = Router()

productsRouter.get('/:productId/variants', async (req, res) => {
  const { productId } = req.params

  try {
    const variants = await getVariantsForProduct(productId)
    res.json(variants)
  } catch (error) {
    res.status(404).json({ error: 'No variants found for this product' })
  }
})
