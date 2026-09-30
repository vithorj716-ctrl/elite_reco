import { createFileRoute } from "@tanstack/react-router";

import { CookieNotice } from "@/components/layout/CookieNotice";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Hero } from "@/components/sections/Hero";
import { BestSellers, Categories, Collections, EditorialBanner, Featured } from "@/components/sections/Shop";
import { Atelier, BenefitsStrip, CustomProcess, FinalCta, Gallery, Journal, SizeGuide, Testimonials } from "@/components/sections/Story";
import { Faq, Newsletter } from "@/components/sections/Support";
import { benefits, socials } from "@/data/site";

const title = "Bekas | Corsets sob medida — Vista sua essência";
const description = "Corsets artesanais feitos sob medida: overbust, underbust, waist cincher e custom. Até 6x sem juros e envio para todo Brasil.";
const siteUrl = import.meta.env.VITE_SITE_URL || "https://html-to-canvas-dream.lovable.app";
const ogImage = `${siteUrl}/catalogo/editorial-jeans-front.webp`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl },
      { property: "og:image", content: ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
    ],
    links: [{ rel: "canonical", href: siteUrl }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Bekas",
          url: siteUrl,
          description,
          sameAs: [socials.instagram],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="overflow-hidden bg-hero py-2 text-hero-foreground">
        <div className="animate-marquee flex w-max gap-12 whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.2em]">
          {[...benefits, "6x sem juros", ...benefits, "6x sem juros"].map((b, i) => (
            <span key={`${b}-${i}`} className="flex items-center gap-12">{b}<span className="size-1 rotate-45 bg-brass" aria-hidden="true" /></span>
          ))}
        </div>
      </div>
      <SiteHeader />
      <Hero />
      <BenefitsStrip />
      <Categories />
      <BestSellers />
      <Testimonials />
      <EditorialBanner />
      <Collections />
      <Featured />
      <CustomProcess />
      <Atelier />
      <Gallery />
      <Journal />
      <SizeGuide />
      <Faq />
      <Newsletter />
      <FinalCta />
      <SiteFooter />
      <CookieNotice />
    </main>
  );
}
