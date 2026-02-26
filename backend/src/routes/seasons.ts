import { Router } from 'express'
import { getProductsForSeasonId, getSeasons } from '../models/seasons.js'

export const seasonsRouter: Router = Router()

seasonsRouter.get('/', async (req, res) => {
  res.json(await getSeasons())
})

seasonsRouter.get('/:seasonId/products', async (req, res) => {
  const { seasonId } = req.params

  try {
    const seasonProducts = await getProductsForSeasonId(seasonId)
    res.json(seasonProducts)
  } catch (error) {
    res.status(404).json({ error: 'No products found for this season' })
  }
})
