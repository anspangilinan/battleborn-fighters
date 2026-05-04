import { AnimationLab } from "@/components/animation-lab";
import { notFound } from "next/navigation";

import { isLabEnabled } from "@/lib/feature-flags";

export default function AnimationLabPage() {
  if (!isLabEnabled()) {
    notFound();
  }

  return (
    <main className="animation-lab-page">
      <div className="shell">
        <AnimationLab />
      </div>
    </main>
  );
}
