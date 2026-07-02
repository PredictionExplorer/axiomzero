import { BRAND_FAQ } from "@/lib/brand";
import { Reveal } from "@/components/ui/reveal";

export function HomeFaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <Reveal>
        <p className="text-sm uppercase tracking-[0.34em] text-copper">
          FAQ
        </p>
        <h2 className="font-display mt-4 text-4xl font-semibold tracking-[-0.05em] text-ivory sm:text-5xl">
          Questions collectors ask before they trade
        </h2>
      </Reveal>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {BRAND_FAQ.map((item, index) => (
          <Reveal key={item.question} delayMs={index * 70}>
            <article className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.045] p-6">
              <h3 className="text-lg font-semibold text-ivory">
                {item.question}
              </h3>
              <p className="mt-3 text-sm leading-7 text-bone/78">
                {item.answer}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
