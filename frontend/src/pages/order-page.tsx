import HeroBar from '@/components/hero-bar'
import NavBar from '@/components/nav-bar'
import ProductCard from '@/components/product-card'

function OrderPage() {
  return (
    <div className="bg-background font-serif flex flex-col">
      <NavBar />
      <HeroBar />
      <main className="bg-background grid grid-cols-1 xl:grid-cols-3 flex-1">
        <section className="p-8 col-span-2 grid gap-6 flex-wrap">
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
        </section>
        <section className="p-8 bg-sidebar-accent">
          <h1 className="uppercase font-mono text-sm pb-4 border-b border-b-accent">
            Your Order
          </h1>
        </section>
      </main>
    </div>
  )
}

export default OrderPage
