export type ProductVariant = {
  id: string
  colorName: string
  colorHex: string
  size: string
  imageUrl: string
  price: number
}

export type Product = {
  id: string
  description: string
  name: string
  supplierModelId: string
  variants: ProductVariant[]
}

export type ProductInstance = Omit<Product, 'variants' | 'id'> & ProductVariant

export type Color = {
  hexCode: string
  name: string
}

export type CartItem = ProductInstance & {
  quantity: number
}
