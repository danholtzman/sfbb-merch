// biome-ignore-all lint/style/noNonNullAssertion: 'seed script'

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { requireEnv } from '../config/env.js'
import {
  orderItems,
  orders,
  productColors,
  products,
  productVariants,
  seasons,
} from './schema.js'

const client = postgres(requireEnv('DATABASE_URL'))
const db = drizzle({ client })

async function main() {
  console.log('Seeding database...')

  // ── Seasons ───────────────────────────────────────────
  const [season] = await db
    .insert(seasons)
    .values({
      name: '2025 Season',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-03-15'),
      isActive: true,
    })
    .returning()

  console.log('✓ Season created')

  if (!season) {
    throw new Error('Failed to create season')
  }

  // ── Products ──────────────────────────────────────────
  const [tee, jacket] = await db
    .insert(products)
    .values([
      {
        seasonId: season.id,
        name: 'Short Sleeve Tee',
        description: 'Classic short sleeve t-shirt',
        supplierModelId: 'SS-2200',
        allowsPersonalization: false,
      },
      {
        seasonId: season.id,
        name: 'Zip Jacket',
        description: 'Full zip jacket with embroidered logo',
        supplierModelId: 'ZJ-4400',
        allowsPersonalization: true,
      },
    ])
    .returning()

  console.log('✓ Products created')

  if (!tee || !jacket) {
    throw new Error('Failed to create products')
  }

  // ── Colors ────────────────────────────────────────────
  const [teeNavy, teeBlack, teeCrimson, teeSand] = await db
    .insert(productColors)
    .values([
      { productId: tee.id, name: 'Navy', imageUrl: null },
      { productId: tee.id, name: 'Black', imageUrl: null },
      { productId: tee.id, name: 'Crimson', imageUrl: null },
      { productId: tee.id, name: 'Sand', imageUrl: null },
    ])
    .returning()

  const [jacketBlack, jacketSlate, jacketNavy] = await db
    .insert(productColors)
    .values([
      { productId: jacket.id, name: 'Black', imageUrl: null },
      { productId: jacket.id, name: 'Slate', imageUrl: null },
      { productId: jacket.id, name: 'Navy', imageUrl: null },
    ])
    .returning()

  console.log('✓ Colors created')

  // ── Variants ──────────────────────────────────────────
  const teeSizes = ['S', 'M', 'L', 'XL', '2XL']
  const jacketSizes = ['S', 'M', 'L', 'XL']
  const teeColors = [teeNavy, teeBlack, teeCrimson, teeSand]
  const jacketColors = [jacketBlack, jacketSlate, jacketNavy]

  await db.insert(productVariants).values([
    ...teeColors.flatMap((color) =>
      teeSizes.map((size) => ({
        productId: tee.id,
        colorId: color!.id,
        size,
        price: '28.00',
      })),
    ),
    ...jacketColors.flatMap((color) =>
      jacketSizes.map((size) => ({
        productId: jacket.id,
        colorId: color!.id,
        size,
        price: '68.00',
      })),
    ),
  ])

  console.log('✓ Variants created')

  // ── Orders ────────────────────────────────────────────
  const bandMembers = [
    { customerName: 'Sarah Chen', customerEmail: 'sarah@band.org' },
    { customerName: 'Marcus Webb', customerEmail: 'marcus@band.org' },
    { customerName: 'Priya Nair', customerEmail: 'priya@band.org' },
    { customerName: 'James Okonkwo', customerEmail: 'james@band.org' },
    { customerName: 'Lena Kowalski', customerEmail: 'lena@band.org' },
  ]

  const statuses = [
    'submitted',
    'submitted',
    'fulfilled',
    'paid',
    'fulfilled',
  ] as const

  const createdOrders = await db
    .insert(orders)
    .values(
      bandMembers.map((member, i) => ({
        seasonId: season.id,
        customerName: member.customerName,
        customerEmail: member.customerEmail,
        status: statuses[i]!,
      })),
    )
    .returning()

  console.log('✓ Orders created')

  // ── Order Items ───────────────────────────────────────
  // Fetch some variants to use
  const allVariants = await db.select().from(productVariants)

  const getVariant = (productId: string, colorName: string, size: string) =>
    allVariants.find((v) => v.productId === productId && v.size === size)

  await db.insert(orderItems).values([
    // Sarah — tee + jacket
    {
      orderId: createdOrders[0]!.id,
      variantId: allVariants.find(
        (v) => v.productId === tee.id && v.size === 'M',
      )!.id,
      quantity: 1,
      personalization: null,
      priceAtPurchase: '28.00',
    },
    {
      orderId: createdOrders[0]!.id,
      variantId: allVariants.find(
        (v) => v.productId === jacket.id && v.size === 'S',
      )!.id,
      quantity: 1,
      personalization: null,
      priceAtPurchase: '68.00',
    },
    // Marcus — jacket with personalization
    {
      orderId: createdOrders[1]!.id,
      variantId: allVariants.find(
        (v) => v.productId === jacket.id && v.size === 'L',
      )!.id,
      quantity: 1,
      personalization: 'Webb',
      priceAtPurchase: '68.00',
    },
    // Priya — two tees
    {
      orderId: createdOrders[2]!.id,
      variantId: allVariants.find(
        (v) => v.productId === tee.id && v.size === 'S',
      )!.id,
      quantity: 2,
      personalization: null,
      priceAtPurchase: '28.00',
    },
    // James — jacket with personalization
    {
      orderId: createdOrders[3]!.id,
      variantId: allVariants.find(
        (v) => v.productId === jacket.id && v.size === 'XL',
      )!.id,
      quantity: 1,
      personalization: 'JO',
      priceAtPurchase: '68.00',
    },
    // Lena — tee + jacket
    {
      orderId: createdOrders[4]!.id,
      variantId: allVariants.find(
        (v) => v.productId === tee.id && v.size === 'M',
      )!.id,
      quantity: 1,
      personalization: null,
      priceAtPurchase: '28.00',
    },
    {
      orderId: createdOrders[4]!.id,
      variantId: allVariants.find(
        (v) => v.productId === jacket.id && v.size === 'M',
      )!.id,
      quantity: 1,
      personalization: null,
      priceAtPurchase: '68.00',
    },
  ])

  console.log('✓ Order items created')
  console.log('✓ Seeding complete')

  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
