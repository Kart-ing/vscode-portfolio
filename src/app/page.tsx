import { Footer } from "@/components/ui/Footer";
import { Identity } from "@/components/ui/Identity";
import { Shell } from "@/components/ui/Shell";

// The identity block and footer are server components handed to the client
// shell as props, so the name, role, tagline, links and the /record link are
// in the HTML before any JavaScript runs.
export default function Home() {
  return <Shell identity={<Identity />} footer={<Footer sound />} />;
}
