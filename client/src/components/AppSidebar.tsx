import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Image,
  FlaskConical,
  LayoutTemplate,
  Settings,
  Zap,
  LogOut,
  Sparkles,
  CreditCard,
  Youtube,
  BarChart3,
  Search,
} from "lucide-react";

interface Stats {
  totalThumbnails: number;
  activeTests: number;
  avgCtr: number;
  creditsRemaining: number;
}

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Video Analyzer", url: "/analyzer", icon: Search },
  { title: "My Videos", url: "/videos", icon: Youtube },
  { title: "Campaigns", url: "/campaigns", icon: Sparkles },
  { title: "My Thumbnails", url: "/thumbnails", icon: Image },
  { title: "A/B Tests", url: "/tests", icon: FlaskConical },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Templates", url: "/templates", icon: LayoutTemplate },
  { title: "Pricing", url: "/pricing", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const getInitials = () => {
    if (!user) return "?";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (!user) return "User";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.email) return user.email.split("@")[0];
    return "User";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-logo">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">SupernovaVid</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Credits</span>
          </div>
          {statsLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <Badge variant="secondary" className="font-mono" data-testid="text-credits">
              {stats?.creditsRemaining?.toLocaleString() || 0}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {getDisplayName()}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
              {user?.email || ""}
            </p>
          </div>
          <SidebarMenuButton asChild className="h-9 w-9 p-0" data-testid="button-logout">
            <a href="/api/logout">
              <LogOut className="h-4 w-4" />
            </a>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
