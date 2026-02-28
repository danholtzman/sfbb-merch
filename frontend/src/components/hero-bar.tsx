export function HeroBar() {
  return (
    <section className="bg-primary p-8 h-48 flex items-center place-content-between shrink-0">
      <div>
        <h1 className="text-4xl mb-4">Annual Merch Order</h1>
        <span className="text-sm font-mono px-4 py-2 border rounded-full -m-1 bg-red-500/40 border-red-700/40 text-red-200">
          <span className="mr-2">●</span>Ordering closes March 15, 2025
        </span>
      </div>
      <div className="text-9xl opacity-40 self-start">2025</div>
    </section>
  )
}

export default HeroBar
