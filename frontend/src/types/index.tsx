export type ProductVariant = {
  colorName: string
  colorHex: string
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

export type Color = {
  hexCode: string
  name: string
}
