"use client";
import {useState,type FormEvent} from "react";
import {ArrowRight,Eye,EyeOff,LockKeyhole,Mail} from "lucide-react";
export default function LoginForm(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[show,setShow]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);
 try{const r=await fetch("/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:String(f.get("email")).trim(),password:f.get("password"),rememberMe:false})});
 if(!r.ok){setError(r.status===503?"O acesso da Sofia ainda precisa ser configurado pelo responsável.":r.status===429?"Muitas tentativas. Aguarde um minuto e tente novamente.":"Não foi possível entrar. Confira seu e-mail e sua senha.");return;}
 window.location.assign("/");}catch{setError("Não conseguimos conectar agora. Tente novamente.");}finally{setBusy(false);}}
 return <form onSubmit={submit} className="login-form"><label>E-mail<div className="login-input"><Mail size={18}/><input name="email" type="email" autoComplete="username" placeholder="Seu e-mail pessoal" required maxLength={254}/></div></label><label>Senha<div className="login-input"><LockKeyhole size={18}/><input name="password" type={show?"text":"password"} autoComplete="current-password" placeholder="Sua senha" required maxLength={128}/><button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?"Ocultar senha":"Mostrar senha"}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{error&&<p role="alert" className="error-text">{error}</p>}<button className="primary-button login-submit" disabled={busy}>{busy?"Entrando…":"Entrar no meu espaço"}<ArrowRight size={18}/></button><p className="login-help">Precisa recuperar seu acesso? Fale com o responsável pelo aplicativo.</p></form>;
}
