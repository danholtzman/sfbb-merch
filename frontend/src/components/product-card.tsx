import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { Color, Product, ProductInstance, ProductVariant } from '@/types'
import ColorSelector from './color-selector'
import QuantitySelector from './quantity-selector'
import SizeSelector from './size-selector'
import { Button } from './ui/button'

type ProductCardProps = {
  product: Product
  onAddToCart: (productInstance: ProductInstance, quantity: number) => void
}

function createProductInstance(
  product: Product,
  variant: ProductVariant,
): ProductInstance {
  const { variants, ...productWithoutVariants } = product
  return {
    ...productWithoutVariants,
    ...variant,
  }
}

function getProductVariant(
  product: Product,
  color: Color,
  size: string,
): ProductVariant | undefined {
  return product.variants.find((variant) => {
    return variant.colorHex === color.hexCode && variant.size === size
  })
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const colors = useMemo<Color[]>(
    () =>
      product.variants.reduce<Color[]>((acc, curr) => {
        if (acc.some((c) => c.hexCode === curr.colorHex)) {
          return acc
        }

        acc.push({ name: curr.colorName, hexCode: curr.colorHex })
        return acc
      }, []),

    [product],
  )
  const sizes = useMemo<string[]>(
    () => [...new Set(product.variants.map((variant) => variant.size))],
    [product],
  )

  const [selectedColor, setSelectedColor] = useState(colors[0])
  const [selectedSize, setSelectedSize] = useState(sizes[0])
  const [quantity, setQuantity] = useState(1)

  const selectedProductVariant = useMemo(() => {
    return getProductVariant(product, selectedColor, selectedSize)
  }, [product, selectedColor, selectedSize])

  if (!selectedProductVariant) {
    return
  }

  return (
    <Card className="w-full p-0">
      <CardContent className="h-full flex flex-row justify-evenly p-0">
        <div
          className="bg-cover bg-center bg-no-repeat min-w-110"
          style={{ backgroundImage: `url(${selectedProductVariant.imageUrl})` }}
        />
        <div className="bg-muted grow p-8">
          <div className="font-mono text-xs">
            Model {product.supplierModelId}
          </div>
          <h1 className="text-xl mb-2">{product.name}</h1>
          <div className="text-2xl text-red-400 mb-8">
            {`$${selectedProductVariant.price}`}
          </div>
          <form className="font-mono">
            <div className="mb-4">
              <div className="font-mono uppercase text-xs mb-2">Color</div>

              <ColorSelector
                colors={colors}
                selectedColor={selectedColor}
                onSelect={(color: Color) => setSelectedColor(color)}
              />
            </div>
            <div className="mb-4">
              <div className="font-mono uppercase text-xs mb-2">Size</div>
              <SizeSelector
                sizes={sizes}
                selectedSize={selectedSize}
                onSelect={(size: string) => setSelectedSize(size)}
              />
            </div>
            <div className="mb-8">
              <div className="font-mono uppercase text-xs mb-2">Quantity</div>
              <QuantitySelector
                quantity={quantity}
                onAdd={() => setQuantity(quantity + 1)}
                onSubtract={() => setQuantity(Math.max(0, quantity - 1))}
              />
            </div>
            {/* TODO: Personalization */}
            <Button
              className="max-w-full/50 block"
              type="button"
              disabled={quantity <= 0}
              onClick={() =>
                onAddToCart(
                  createProductInstance(product, selectedProductVariant),
                  quantity,
                )
              }
            >
              + Add to Cart
            </Button>
          </form>
        </div>
        <div></div>
      </CardContent>
    </Card>
  )
}

export default ProductCard
