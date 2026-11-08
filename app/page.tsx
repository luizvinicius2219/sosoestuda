import { redirect } from "next/navigation";
import StudyApp from "@/components/study-app";
import {getSofiaUser} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getSofiaUser();if(!user)redirect("/login");return <StudyApp initialUser={{name:"Sofia",email:user.email}}/>;}
