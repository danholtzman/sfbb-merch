import 'dotenv/config'
import express from 'express'
import { productsRouter } from './routes/products.js'
import { seasonsRouter } from './routes/seasons.js'

const app = express()
app.use(express.json())

app.use('/api/seasons', seasonsRouter)
app.use('/api/products', productsRouter)

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})

// CRUD season
// CRUD product
// CRUD order
//

// GET /seasons
// POST /seasons
// GET /seasons
// POST /products
// POST /orders
