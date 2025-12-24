import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, ArrowRight, Sparkles, BarChart3, Trophy, Clock, Loader2, Crown, Users, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const launchFeatures = [
  "10 optimization campaigns/month",
  "AI-generated thumbnail variations",
  "Automatic A/B testing on YouTube",
  "Video transcript analysis",
  "4-5x daily optimization iterations",
  "Real-time performance dashboard",
  "95% statistical confidence settling",
  "Email support",
];

const scaleFeatures = [
  "Unlimited optimization campaigns",
  "AI-generated thumbnail variations",
  "Automatic A/B testing on YouTube",
  "Video transcript analysis",
  "4-5x daily optimization iterations",
  "Real-time performance dashboard",
  "95% statistical confidence settling",
  "Priority support",
  "Advanced analytics & insights",
  "Batch video optimization",
  "API access for automation",
];

const enterpriseFeatures = [
  "Everything in Scale, plus:",
  "Custom campaign limits",
  "Dedicated account manager",
  "Custom integrations",
  "SLA guarantees",
  "Team collaboration tools",
  "White-label options",
  "Volume discounts",
];

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  active: boolean;
  metadata: Record<string, string>;
}

interface Product {
  id: string;
  name: string;
  description: string;
  active: boolean;
  metadata: Record<string, string>;
  prices: Price[];
}

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ["/api/stripe/products"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ priceId, mode }: { priceId: string; mode: 'subscription' | 'payment' }) => {
      const res = await apiRequest("POST", "/api/stripe/create-checkout-session", { priceId, mode });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setLoadingPriceId(null);
    },
  });

  const products = productsData?.data || [];
  const launchProduct = products.find(p => p.metadata?.plan === 'launch' || p.metadata?.plan === 'creator');
  const scaleProduct = products.find(p => p.metadata?.plan === 'scale' || p.metadata?.plan === 'pro');

  const launchPrice = launchProduct?.prices?.find(p => p.active && p.recurring);
  const scalePrice = scaleProduct?.prices?.find(p => p.active && p.recurring);

  const handleCheckout = (priceId: string | undefined, mode: 'subscription' | 'payment', planName: string) => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    if (!priceId) {
      toast({
        title: "Setup Required",
        description: `Please configure Stripe products for the ${planName} plan. Contact support for assistance.`,
        variant: "destructive",
      });
      return;
    }
    setLoadingPriceId(priceId);
    checkoutMutation.mutate({ priceId, mode });
  };

  const handleEnterprise = () => {
    window.location.href = "mailto:enterprise@supernovavid.com?subject=Enterprise%20Inquiry";
  };

  const formatPrice = (amount: number) => {
    return `$${(amount / 100).toFixed(0)}`;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Simple Pricing. Powerful Results.</h1>
        <p className="text-muted-foreground mt-2">
          The only AI that generates, tests, AND optimizes thumbnails automatically.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <Card className="relative" data-testid="card-pricing-launch">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-xl">Launch</CardTitle>
            </div>
            <CardDescription>For individual creators</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">
                {launchPrice ? formatPrice(launchPrice.unit_amount) : "$59"}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed monthly
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {launchFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              className="w-full mt-4 bg-blue-600"
              disabled={loadingPriceId === launchPrice?.id}
              onClick={() => handleCheckout(launchPrice?.id, 'subscription', 'Launch')}
              data-testid="button-get-started-launch"
            >
              {loadingPriceId === launchPrice?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="relative border-2 border-blue-500" data-testid="card-pricing-scale">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-blue-600 text-white">Most Popular</Badge>
          </div>
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-xl">Scale</CardTitle>
            </div>
            <CardDescription>For power users & agencies</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">
                {scalePrice ? formatPrice(scalePrice.unit_amount) : "$149"}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed monthly
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {scaleFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              className="w-full mt-4 bg-blue-600"
              disabled={loadingPriceId === scalePrice?.id}
              onClick={() => handleCheckout(scalePrice?.id, 'subscription', 'Scale')}
              data-testid="button-get-started-scale"
            >
              {loadingPriceId === scalePrice?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="relative" data-testid="card-pricing-enterprise">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-xl">Enterprise</CardTitle>
            </div>
            <CardDescription>For large teams & networks</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">Custom</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Contact us for pricing
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {enterpriseFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <Button 
              className="w-full mt-4"
              variant="outline"
              onClick={handleEnterprise}
              data-testid="button-contact-enterprise"
            >
              Contact Sales
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-12">
        <h2 className="text-2xl font-bold mb-8">Why Creators Choose SupernovaVid</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 mx-auto rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">Only AI Solution</h3>
              <p className="text-sm text-muted-foreground">The only tool that generates AND tests thumbnails with AI</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 mx-auto rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="font-semibold mb-2">Real A/B Testing</h3>
              <p className="text-sm text-muted-foreground">Actually swaps thumbnails on your YouTube channel</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 mx-auto rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold mb-2">Auto-Optimization</h3>
              <p className="text-sm text-muted-foreground">4-5x daily iterations find the winner automatically</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 mx-auto rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold mb-2">Hands-Off</h3>
              <p className="text-sm text-muted-foreground">Set it and forget it while you create content</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-center mt-12 p-8 bg-muted/50 rounded-lg">
        <h3 className="text-xl font-semibold mb-2">Average 47% CTR improvement</h3>
        <p className="text-muted-foreground">
          One successful optimization can mean thousands more views. SupernovaVid pays for itself.
        </p>
      </div>
    </div>
  );
}
