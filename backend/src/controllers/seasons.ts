import { findProductsForSeasonId, findSeasons } from '../models/seasons.js'

export const getProductsForSeasonId = async (req, res) => {
  const { seasonId } = req.params

  const seasonProducts = await findProductsForSeasonId(seasonId)

  if (!seasonProducts.length) {
    res.status(404).json({ error: 'No products found for this season' })
  }

  res.json(seasonProducts)
}

export const getSeasons = async (req, res) => {
  const seasonProducts = await findSeasons()
  res.json(seasonProducts)
}
