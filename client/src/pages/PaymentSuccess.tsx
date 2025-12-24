import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center" data-testid="card-payment-success">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="text-success-title">Payment Successful!</CardTitle>
          <CardDescription>
            Your subscription is now active. Welcome to SupernovaVid!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Redirecting to your dashboard in {countdown} seconds...
          </p>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <Button 
            onClick={() => setLocation("/dashboard")} 
            className="w-full"
            data-testid="button-go-to-dashboard"
          >
            Go to Dashboard Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
