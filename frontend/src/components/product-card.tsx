import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { Product, ProductVariant } from '@/types/product'
import ColorSelector from './color-selector'
import QuantitySelector from './quantity-selector'
import SizeSelector from './size-selector'
import { Button } from './ui/button'

type ProductCardProps = {
  product: Product
}

function getProductVariant(
  product: Product,
  color: string,
  size: string,
): ProductVariant | undefined {
  return product.variants.find((variant) => {
    return variant.color === color && variant.size === size
  })
}

function ProductCard({ product }: ProductCardProps) {
  const colors = useMemo(
    () => [...new Set(product.variants.map((variant) => variant.color))],
    [product],
  )
  const sizes = useMemo(
    () => [...new Set(product.variants.map((variant) => variant.size))],
    [product],
  )

  const [selectedColor, setSelectedColor] = useState(colors[0])
  const [selectedSize, setSelectedSize] = useState(sizes[0])
  const [quantity, setQuantity] = useState(0)

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
              {/* TODO: Color name on hover */}
              <ColorSelector
                colors={colors}
                selectedColor={selectedColor}
                onSelect={(color: string) => setSelectedColor(color)}
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
            {/* TODO: Disabled until quantity > 0, default quantity to 1? */}
            <Button className="max-w-full/50 block">+ Add to Order</Button>
          </form>
        </div>
        <div></div>
      </CardContent>
    </Card>
  )
}

export default ProductCard
