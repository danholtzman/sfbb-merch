import 'dotenv/config'
import express from 'express'
import { productsRouter } from './routes/products.js'
import { seasonsRouter } from './routes/seasons.js'

const app = express()
app.use(express.json())

// allow CORS:
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

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
