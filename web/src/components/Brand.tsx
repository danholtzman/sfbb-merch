import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand${light ? " brand-light" : ""}`} href="/" aria-label="San Francisco Brass Band home">
    <picture>
      {!light && <source media="(prefers-color-scheme: dark)" srcSet="/brand/sfbb-logo-dark.png" />}
      <img className="brand-logo" src={light ? "/brand/sfbb-logo-dark.png" : "/brand/sfbb-logo.png"} width={1788} height={973} alt="" />
    </picture>
  </Link>;
}
