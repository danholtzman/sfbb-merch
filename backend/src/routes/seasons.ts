import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { getProductsForSeasonId } from '../controllers/seasons.js'
import { db } from '../db/index.js'
import { products, seasons } from '../db/schema.js'

export const seasonsRouter: Router = Router()

seasonsRouter.get('/', async (req, res) => {
  res.json(await db.select().from(seasons))
})

seasonsRouter.get('/:seasonId/products', getProductsForSeasonId)
