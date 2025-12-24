import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Videos from "@/pages/Videos";
import CampaignList from "@/pages/CampaignList";
import CampaignCreate from "@/pages/CampaignCreate";
import CampaignDetail from "@/pages/CampaignDetail";
import Thumbnails from "@/pages/Thumbnails";
import Tests from "@/pages/Tests";
import Analytics from "@/pages/Analytics";
import Templates from "@/pages/Templates";
import Settings from "@/pages/Settings";
import Pricing from "@/pages/Pricing";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Analyzer from "@/pages/Analyzer";
import NotFound from "@/pages/not-found";

interface SubscriptionStatus {
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
}

function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ["/api/stripe/subscription"],
  });
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b h-16 shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/analyzer" component={Analyzer} />
              <Route path="/videos" component={Videos} />
              <Route path="/campaigns" component={CampaignList} />
              <Route path="/campaigns/create" component={CampaignCreate} />
              <Route path="/campaign/:id" component={CampaignDetail} />
              <Route path="/thumbnails" component={Thumbnails} />
              <Route path="/tests" component={Tests} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/templates" component={Templates} />
              <Route path="/settings" component={Settings} />
              <Route path="/pricing" component={Pricing} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function PricingOnlyApp() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-4 p-4 border-b h-16">
        <h1 className="text-xl font-bold">SupernovaVid</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a href="/api/logout" className="text-sm text-muted-foreground hover:text-foreground">
            Logout
          </a>
        </div>
      </header>
      <main className="p-6">
        <Switch>
          <Route path="/payment-success" component={PaymentSuccess} />
          <Route component={Pricing} />
        </Switch>
      </main>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  if (isLoading || (isAuthenticated && subLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  // If authenticated but no active subscription, show pricing page only
  if (!subscription?.hasSubscription) {
    return <PricingOnlyApp />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
