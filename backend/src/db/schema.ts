import {
  boolean,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const appSchema = pgSchema('sfbb-merch')

const timestamps = {
  updatedAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
  deletedAt: timestamp(),
}

export const seasons = appSchema.table.withRLS('seasons', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  startDate: timestamp({ withTimezone: true }).notNull(),
  endDate: timestamp({ withTimezone: true }).notNull(),
  isActive: boolean().notNull().default(false),
  ...timestamps,
})

export const products = appSchema.table.withRLS('products', {
  id: uuid().primaryKey().defaultRandom(),
  seasonId: uuid()
    .references(() => seasons.id)
    .notNull(),
  name: text().notNull(),
  description: text(),
  supplierModelId: text().notNull(),
  allowsPersonalization: boolean().notNull().default(false),
  ...timestamps,
})

export const productColors = appSchema.table.withRLS('product_colors', {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid()
    .references(() => products.id)
    .notNull(),
  name: text().notNull(),
  imageUrl: text(),
  ...timestamps,
})

export const productVariants = appSchema.table.withRLS('product_variants', {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid()
    .references(() => products.id)
    .notNull(),
  colorId: uuid()
    .references(() => productColors.id)
    .notNull(),
  size: text().notNull(),
  price: numeric().notNull(),
  ...timestamps,
})

export const orders = appSchema.table.withRLS('orders', {
  id: uuid().primaryKey().defaultRandom(),
  seasonId: uuid()
    .references(() => seasons.id)
    .notNull(),
  customerName: text().notNull(),
  customerEmail: text().notNull(),
  status: text().notNull(),
  token: uuid().defaultRandom().unique().notNull(),
  ...timestamps,
})

export const orderItems = appSchema.table.withRLS('order_items', {
  id: uuid().primaryKey().defaultRandom(),
  orderId: uuid()
    .references(() => orders.id)
    .notNull(),
  variantId: uuid().references(() => productVariants.id),
  quantity: integer().notNull(),
  personalization: text(),
  priceAtPurchase: numeric().notNull(),
  ...timestamps,
})

// export type InsertUser = typeof usersTable.$inferInsert
// export type SelectUser = typeof usersTable.$inferSelect

// export type InsertPost = typeof postsTable.$inferInsert
// export type SelectPost = typeof postsTable.$inferSelect
