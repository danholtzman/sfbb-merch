import CartItem from './cart-item'

function Cart() {
  return (
    <section className="bg-sidebar-accent">
      <div className="flex flex-row max-w-full justify-between items-center border-b border-b-accent px-8 py-4">
        <h1 className="text-xl">Your Order</h1>
        <span className="uppercase font-mono text-sm text-muted-foreground">
          4 items
        </span>
      </div>

      <div className="flex flex-col px-8">
        {/* TODO: Compute total prices on server */}
        {/* TODO: Price formatting */}
        {/* TODO: Color name? */}
        <CartItem
          name="Short Sleeve Tee"
          totalPrice="$56.00"
          perItemPrice="$28.00"
          quantity={2}
          size="M"
          imageUrl="http://127.0.0.1:54321/storage/v1/object/public/images/merch-2025/mens-purple.jpg"
        />

        <CartItem
          name="Zip Jacket"
          totalPrice="$68.00"
          personalization="Webb"
          quantity={1}
          size="L"
          imageUrl="http://127.0.0.1:54321/storage/v1/object/public/images/merch-2025/mens-jacket-crosshatch.png"
        />
      </div>
    </section>
  )
}

export default Cart
