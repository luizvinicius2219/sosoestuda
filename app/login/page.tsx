import {redirect} from "next/navigation";
import {getSofiaUser} from "@/lib/auth";
import LoginForm from "@/components/login-form";
import Mascot from "@/components/Mascot";
export const dynamic="force-dynamic";
export default async function Login(){if(await getSofiaUser())redirect("/");return <main className="sofia-login"><section className="login-story"><a className="login-brand" href="/login">soso<span>estuda</span> ✦</a><div><span className="hero-eyebrow">SEU PRÓXIMO CAPÍTULO</span><h1>Um sonho grande.<br/>Um passo de<br/><em>cada vez.</em></h1><p>Seu espaço para aprender, evoluir e construir a aprovação.</p></div><Mascot/><small>Seu ritmo. Sua jornada. Suas conquistas.</small></section><section className="login-side"><div className="login-box"><span className="login-private">✦ ESPAÇO PESSOAL DA SOFIA</span><h2>Bem-vinda, Sofia.</h2><p>Que bom ter você por aqui.<br/>Vamos cuidar do seu próximo passo?</p><LoginForm/><small className="login-footnote">Acesso pessoal e protegido. Apenas a conta autorizada pode entrar.</small></div><span className="login-copyright">SosoEstuda · Um estudo de cada vez ♡</span></section></main>;}
