import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Check, ChevronDown, Star } from "lucide-react";
import { useState, useEffect } from "react";
import dashboardMockup from "@assets/generated_images/campaign_cards_dashboard_mockup.png";

function useFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "faq-schema";
    script.textContent = JSON.stringify(faqSchema);
    
    const existingScript = document.getElementById("faq-schema");
    if (existingScript) {
      existingScript.remove();
    }
    
    document.head.appendChild(script);
    
    return () => {
      const scriptToRemove = document.getElementById("faq-schema");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [faqs]);
}

const faqs = [
  {
    question: "How does autonomous optimization work?",
    answer: "Paste a video URL. We extract the transcript, generate 4-6 AI thumbnails, run A/B tests on YouTube, and optimize 4-5x daily until finding your winner at 95% confidence. Completely hands-off.",
  },
  {
    question: "What's the difference between plans?",
    answer: "Launch ($59/mo): 10 campaigns/month for individual creators. Scale ($149/mo): Unlimited campaigns with priority support and API access for agencies.",
  },
  {
    question: "How long does optimization take?",
    answer: "Most campaigns complete in 3-5 days. High-traffic videos can finish in 24-48 hours. We run 4-5 cycles daily until reaching 95% statistical confidence.",
  },
  {
    question: "Do I need to do anything after purchasing?",
    answer: "Nothing. Connect YouTube once (30 seconds), paste the video URL, and we handle everything. You get notified when the winning thumbnail is selected.",
  },
  {
    question: "Will this hurt my video performance?",
    answer: "No. A/B testing shows your current thumbnail to 50% of viewers. If a variant wins, you benefit immediately. If yours is best, it stays. No SEO penalty.",
  },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  useFAQSchema(faqs);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">SupernovaVid</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero - Asymmetrical */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4">
                Autonomous Thumbnail Optimization
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
                Paste URL. Get your highest CTR thumbnail.
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-md">
                AI generates thumbnails, runs A/B tests, optimizes 4-5x daily. Completely hands-off.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login">
                    Get Started
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="font-semibold">4-5x daily iterations</span>
                <span className="text-muted-foreground">|</span>
                <span className="font-semibold">Data-driven winner</span>
                <span className="text-muted-foreground">|</span>
                <span className="font-semibold">3-5 days avg</span>
              </div>
            </div>
            <div className="relative">
              <img 
                src={dashboardMockup} 
                alt="SupernovaVid dashboard showing YouTube thumbnail A/B testing" 
                className="rounded-md border shadow-lg w-full"
                data-testid="img-product-mockup"
              />
            </div>
          </div>
        </section>

        {/* How It Works - Simple list */}
        <section className="py-12 px-6 border-t">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">How It Works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div data-testid="step-1">
                <div className="text-3xl font-bold text-primary mb-2">1</div>
                <h3 className="font-semibold mb-1">Paste URL</h3>
                <p className="text-sm text-muted-foreground">Connect YouTube once, paste any video URL</p>
              </div>
              <div data-testid="step-2">
                <div className="text-3xl font-bold text-primary mb-2">2</div>
                <h3 className="font-semibold mb-1">AI Analyzes</h3>
                <p className="text-sm text-muted-foreground">Extracts transcript, identifies key moments</p>
              </div>
              <div data-testid="step-3">
                <div className="text-3xl font-bold text-primary mb-2">3</div>
                <h3 className="font-semibold mb-1">Tests & Optimizes</h3>
                <p className="text-sm text-muted-foreground">Creates thumbnails, runs A/B tests automatically</p>
              </div>
              <div data-testid="step-4">
                <div className="text-3xl font-bold text-primary mb-2">4</div>
                <h3 className="font-semibold mb-1">Winner Selected</h3>
                <p className="text-sm text-muted-foreground">Get notified when the best thumbnail is found</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features - Not all cards, simple list with checks */}
        <section className="py-12 px-6 border-t bg-muted/30">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold mb-6">Everything Automated</h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>AI thumbnail generation from your video content</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Automatic A/B testing on YouTube</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>4-5 optimization cycles daily</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Statistical confidence before declaring winner</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Works with any YouTube video</span>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-6">Built for Creators</h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Revive old videos with low CTR</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Mobile-optimized thumbnails</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>No misleading clickbait - designed to match content</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Dashboard with performance metrics</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span>Connect multiple channels on one subscription</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Social proof - inline, simple */}
        <section className="py-12 px-6 border-t">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-primary text-primary" />
              ))}
              <span className="ml-2 text-muted-foreground">Loved by creators</span>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <blockquote className="text-muted-foreground">
                "Increased our CTR by 63% in two weeks. Best investment for our channel."
              </blockquote>
              <blockquote className="text-muted-foreground">
                "Takes the guesswork out of thumbnails. The A/B testing is seamless."
              </blockquote>
              <blockquote className="text-muted-foreground">
                "3x faster than other tools and dramatically better results."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Pricing - cleaner */}
        <section className="py-12 px-6 border-t bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-center">Simple Pricing</h2>
            <p className="text-muted-foreground text-center mb-8">Start free, upgrade when ready</p>
            <div className="grid md:grid-cols-2 gap-6">
              <Card data-testid="card-pricing-launch" className="hover-elevate">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-1">Launch</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold">$59</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      10 campaigns/month
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Full autonomous optimization
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      AI thumbnail generation
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Automatic A/B testing
                    </li>
                  </ul>
                  <Button variant="outline" className="w-full" asChild data-testid="button-select-launch">
                    <a href="/api/login">Get Started</a>
                  </Button>
                </CardContent>
              </Card>
              <Card data-testid="card-pricing-scale" className="border-primary hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-lg">Scale</h3>
                    <Badge variant="default">Popular</Badge>
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold">$149</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Unlimited campaigns
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Everything in Launch
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Priority support
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      API access
                    </li>
                  </ul>
                  <Button className="w-full" asChild data-testid="button-select-scale">
                    <a href="/api/login">Get Started</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ - fewer items */}
        <section className="py-12 px-6 border-t">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Common Questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border rounded-md" data-testid={`faq-item-${idx}`}>
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover-elevate rounded-md"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    data-testid={`button-faq-${idx}`}
                  >
                    <span className="font-medium pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 pb-4 text-muted-foreground text-sm">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA - simple */}
        <section className="py-16 px-6 border-t bg-primary text-primary-foreground">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-3">Ready to optimize your thumbnails?</h2>
            <p className="mb-6 opacity-90">Start free. See results in 3-5 days.</p>
            <Button size="lg" variant="secondary" asChild data-testid="button-cta-final">
              <a href="/api/login">
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span>SupernovaVid</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
