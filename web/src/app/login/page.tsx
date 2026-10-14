import { redirect } from "next/navigation";
import { Brand } from "../../components/Brand";
import { LoginForm } from "../../features/auth/LoginForm";
import { pageSession } from "../../server/context";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const session = await pageSession();
  if (session) redirect(session.actor.role === "admin" ? "/admin" : "/shop");
  return <main className="login-page">
    <section className="login-story">
      <Brand light />
      <div className="login-story-copy"><span className="eyebrow">ONE BAND. ONE BIG SOUND.</span><h1>Good music.<br />Great company.<br /><em>Your band.</em></h1><p>The season’s merchandise, all in one place.<br />Pick your favorites. Wear the music.</p></div>
      <div className="login-story-footer">SAN FRANCISCO BRASS BAND <span aria-hidden="true">✦</span></div>
    </section>
    <section className="login-form-panel">
      <div className="login-form-wrap"><span className="eyebrow">SFBB / MERCHANDISE</span><h2>Welcome, band.</h2><p>Sign in with the band’s shared member or admin account.</p><LoginForm /><div className="shared-access-note"><span aria-hidden="true">♧</span><p>Two shared accounts. No personal account needed.<br />Ask the band’s merch admin for access details.</p></div></div>
      <span className="login-footer">Made for the band, by the band.</span>
    </section>
  </main>;
}
