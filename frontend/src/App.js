import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import NewEvent from "@/pages/NewEvent";
import EventEditor from "@/pages/EventEditor";
import Guests from "@/pages/Guests";
import RsvpDashboard from "@/pages/RsvpDashboard";
import Publish from "@/pages/Publish";
import PublicInvitation from "@/pages/PublicInvitation";
import AuthCallback from "@/pages/AuthCallback";
import { AuthProvider } from "@/lib/auth";
import "@/App.css";

function AppRouter() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/events/new" element={<NewEvent />} />
      <Route path="/events/:eventId/edit" element={<EventEditor />} />
      <Route path="/events/:eventId/guests" element={<Guests />} />
      <Route path="/events/:eventId/rsvp" element={<RsvpDashboard />} />
      <Route path="/events/:eventId/publish" element={<Publish />} />
      <Route path="/inv/:slug" element={<PublicInvitation />} />
      <Route path="/inv/:slug/:guestSlug" element={<PublicInvitation />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
