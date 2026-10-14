import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand${light ? " brand-light" : ""}`} href="/" aria-label="San Francisco Brass Band home">
    <span className="brand-mark" aria-hidden="true">SF<span>BB</span><i>♫</i></span>
    <span className="brand-name">SAN FRANCISCO<br />BRASS BAND</span>
  </Link>;
}
