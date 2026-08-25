import { Link, useNavigate } from "react-router-dom";
import { useAuth, loginWithGoogle } from "@/lib/auth";
import { LogOut, LayoutDashboard, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function Header({ variant = "app" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 glass" data-testid="app-header">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2" data-testid="brand-link">
          <div className="w-9 h-9 rounded-full bg-[#c05c46] flex items-center justify-center text-white font-heading font-bold text-lg">
            u.
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-heading font-bold text-lg tracking-tight">Undangan-Q</span>
            <span className="overline mt-0.5">Bagikan Momen Bahagiamu</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <button
                data-testid="nav-dashboard"
                onClick={() => navigate("/dashboard")}
                className="btn-ghost hidden sm:inline-flex text-sm"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </button>
              <button
                data-testid="nav-new-event"
                onClick={() => navigate("/events/new")}
                className="btn-primary text-sm"
              >
                <Plus className="w-4 h-4" /> Undangan Baru
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="user-menu-trigger" className="ml-2">
                    <img
                      src={user.picture || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.name)}
                      alt={user.name}
                      className="w-9 h-9 rounded-full border border-[#e2dfd9]"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <div className="text-sm font-semibold">{user.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{user.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-logout" onClick={logout} className="cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <button data-testid="btn-google-login" onClick={loginWithGoogle} className="btn-primary text-sm">
              Masuk dengan Google
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
