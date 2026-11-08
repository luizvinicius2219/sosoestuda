import StudyApp from "@/components/study-app";
import { getChatGPTUser } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return <StudyApp initialUser={user ? { name: user.fullName ?? user.displayName.split("@")[0], email: user.email } : null} />;
}
