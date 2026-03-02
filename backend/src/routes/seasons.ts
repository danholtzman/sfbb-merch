import { Router } from 'express'
import { getProductsForSeasonId, getSeasons } from '../models/seasons.js'

export const seasonsRouter: Router = Router()

seasonsRouter.get('/', async (_req, res) => {
  const seasons = await getSeasons()
  res.json(
    seasons.map((season) => {
      const { id, name, startDate, endDate, isActive } = season
      return {
        id,
        name,
        startDate,
        endDate,
        isActive,
      }
    }),
  )
})

seasonsRouter.get('/:seasonId/products', async (req, res) => {
  const { seasonId } = req.params

  try {
    const seasonProducts = await getProductsForSeasonId(seasonId)

    res.json(seasonProducts)
  } catch (_error) {
    res.status(404).json({ error: 'No products found for this season' })
  }
})
