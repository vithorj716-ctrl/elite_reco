import { useRef, useState } from "react";

import { revealSection } from "@/animations/reveal";
import { Butterfly } from "@/components/brand/Butterfly";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { faq } from "@/data/site";
import { useGsap } from "@/hooks/use-gsap";

export function Faq() {
  const ref = useRef<HTMLElement>(null);
  useGsap((s) => revealSection(s), ref);
  return (
    <section id="faq" ref={ref} className="bg-card py-28 md:py-40">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-12 md:px-10">
        <SectionHeading eyebrow="Dúvidas" title={<>Perguntas <em className="font-normal">frequentes</em></>} className="md:col-span-5 md:block" />
        <Accordion type="single" collapsible className="md:col-span-7" data-reveal>
          {faq.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className="border-border">
              <AccordionTrigger className="py-6 text-left font-display text-xl hover:no-underline data-[state=open]:text-magenta md:text-2xl">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-6 text-[13px] leading-7 text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function Newsletter() {
  const ref = useRef<HTMLElement>(null);
  const [sent, setSent] = useState(false);
  useGsap((s) => revealSection(s), ref);
  return (
    <section ref={ref} className="py-28 md:py-40">
      <div className="relative mx-auto max-w-4xl overflow-hidden px-5 text-center md:px-10">
        <div data-reveal className="group mx-auto mb-8 w-14"><Butterfly beat="hover" /></div>
        <h2 data-reveal className="font-display text-4xl leading-tight md:text-6xl">Entre para o <em className="font-normal text-signature">universo da marca.</em></h2>
        <p data-reveal className="mx-auto mt-5 max-w-md text-[13px] leading-6 text-muted-foreground">Receba 5% de desconto na primeira compra, acesso antecipado às coleções e bastidores exclusivos do atelier.</p>
        {sent ? (
          <p role="status" className="mt-10 text-[12px] uppercase tracking-[0.2em] text-magenta">Obrigada! Você já faz parte.</p>
        ) : (
          <form data-reveal onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="mx-auto mt-10 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label htmlFor="nl-email" className="sr-only">Seu melhor email</label>
            <input id="nl-email" type="email" required placeholder="Seu melhor email" className="h-12 flex-1 rounded-full border border-foreground/20 bg-transparent px-6 text-[13px] outline-none transition-colors focus:border-magenta" />
            <Button type="submit" variant="signature"><span>Quero receber</span></Button>
          </form>
        )}
      </div>
    </section>
  );
}
