import Link from "next/link";

import { OnlineRoomPanel } from "@/components/online-room-panel";

export default function OnlinePage() {
  return (
    <main className="shell shell-narrow">
      <Link className="back-link" href="/">
        Back to menu
      </Link>
      <section className="hero-panel">
        <p className="eyebrow">Online Sessions</p>
        <h1>Create a room or join a live fight.</h1>
        <p className="lead">
          The app signs a room token on Vercel, then the browser connects to the Render match service over WebSockets.
          Set <code>NEXT_PUBLIC_MATCH_SERVICE_URL</code> to your Render endpoint before deploying.
        </p>
      </section>
      <OnlineRoomPanel />
    </main>
  );
}
