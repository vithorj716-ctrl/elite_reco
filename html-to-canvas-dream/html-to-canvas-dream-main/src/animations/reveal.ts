import { EASE, getGsap } from "@/lib/motion";

/**
 * Batched scroll reveals for a section. Kept short and triggered early so
 * content is already visible when users scroll fast (no blank screens).
 *  - [data-reveal]      soft rise + fade
 *  - [data-reveal-mask] image uncovered by a clip-path from the bottom
 *  - [data-parallax]    tiny vertical drift, value = yPercent range
 */
export function revealSection(scope: HTMLElement) {
  const { gsap, ScrollTrigger } = getGsap();

  const items = Array.from(scope.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (items.length) {
    gsap.set(items, { autoAlpha: 0, y: 16 });
    ScrollTrigger.batch(items, {
      start: "top bottom+=120",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.04, ease: EASE.soft, overwrite: true }),
    });
  }

  scope.querySelectorAll<HTMLElement>("[data-reveal-mask]").forEach((el) => {
    const img = el.querySelector("img");
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top bottom+=80", once: true } });
    tl.fromTo(el, { clipPath: "inset(12% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, ease: EASE.soft, clearProps: "clipPath" });
    if (img) tl.fromTo(img, { scale: 1.06 }, { scale: 1, duration: 0.8, ease: EASE.soft }, 0);
  });

  scope.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
    const amount = Number(el.dataset["parallax"] || 8);
    gsap.fromTo(
      el,
      { yPercent: -amount / 2 },
      { yPercent: amount / 2, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true } },
    );
  });

  scope.querySelectorAll<HTMLElement>("[data-drift]").forEach((el) => {
    const direction = el.dataset["drift"] === "left" ? -1 : 1;
    gsap.fromTo(
      el,
      { xPercent: direction * -1.2, rotate: direction * -0.25 },
      { xPercent: direction * 1.2, rotate: direction * 0.25, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: 0.7 } },
    );
  });
}
