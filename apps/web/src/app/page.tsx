import { HomeScreen } from "@/components/home-screen";
import { isLabEnabled } from "@/lib/feature-flags";

export default function HomePage() {
  return <HomeScreen showLab={isLabEnabled()} />;
}
