export type ProductVariant = {
  color: string
  size: string
  imageUrl: string
  price: string
}

export type Product = {
  id: string
  description: string
  name: string
  supplierModelId: string
  variants: ProductVariant[]
}
