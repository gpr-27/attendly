import { auth } from "@clerk/nextjs/server";
import { LandingPage } from "@/components/auth/landing-page";
import { TodayScreen } from "@/components/today/today-screen";

export default async function HomePage() {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <TodayScreen />;
}
