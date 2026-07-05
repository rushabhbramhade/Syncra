import { Navigation } from "@/components/sections/navigation";
import { Hero } from "@/components/sections/hero";
import { TrustedBy } from "@/components/sections/trusted-by";
import { Problem } from "@/components/sections/problem";
import { Solution } from "@/components/sections/solution";
import { ProductPreview } from "@/components/sections/product-preview";
import { FeaturesBento } from "@/components/sections/features-bento";
import { Integrations } from "@/components/sections/integrations";
import { AICapabilities } from "@/components/sections/ai-capabilities";
import { WorkflowTimeline } from "@/components/sections/workflow-timeline";
import { Testimonials } from "@/components/sections/testimonials";
import { Statistics } from "@/components/sections/statistics";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { FinalCTA } from "@/components/sections/final-cta";
import { Footer } from "@/components/layout/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background-mist">
      <Navigation />
      <main className="flex-grow">
        <Hero />
        <TrustedBy />
        <Problem />
        <Solution />
        <ProductPreview />
        <FeaturesBento />
        <Integrations />
        <AICapabilities />
        <WorkflowTimeline />
        <Testimonials />
        <Statistics />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
