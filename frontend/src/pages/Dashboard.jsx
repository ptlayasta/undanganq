import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, loginWithGoogle } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import Header from "@/components/app/Header";
import { Plus, Users, Calendar, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await apiClient.get("/events");
        setEvents(data);
      } catch (e) {
        toast.error("Gagal memuat undangan");
      } finally {
        setFetching(false);
      }
    })();
  }, [user]);

  const del = async (id) => {
    if (!window.confirm("Hapus undangan ini?")) return;
    try {
      await apiClient.delete(`/events/${id}`);
      setEvents(events.filter((e) => e.event_id !== id));
      toast.success("Undangan dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c05c46] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div>
            <span className="overline">Beranda</span>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight mt-2">Selamat datang, {user.name.split(" ")[0]}.</h1>
            <p className="text-neutral-500 mt-2 font-body">Kelola undangan digital Anda di satu tempat.</p>
          </div>
          <button data-testid="dashboard-new-event" onClick={() => navigate("/events/new")} className="btn-primary">
            <Plus className="w-4 h-4" /> Undangan Baru
          </button>
        </div>

        {fetching ? (
          <div className="text-center py-16 text-neutral-500">Memuat...</div>
        ) : events.length === 0 ? (
          <div className="border border-dashed border-[#e2dfd9] rounded-3xl p-16 text-center bg-white">
            <div className="w-16 h-16 rounded-full bg-[#f4f1ea] mx-auto flex items-center justify-center">
              <Calendar className="w-7 h-7 text-[#c05c46]" />
            </div>
            <h3 className="font-heading text-2xl font-bold mt-4">Belum ada undangan</h3>
            <p className="text-neutral-500 mt-2 font-body">Mulai dari template atau buat dari awal.</p>
            <button data-testid="empty-create-btn" onClick={() => navigate("/events/new")} className="btn-primary mt-6">
              <Plus className="w-4 h-4" /> Buat Undangan Pertama
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="events-grid">
            {events.map((e) => (
              <div key={e.event_id} className="rounded-2xl bg-white border border-[#e2dfd9] p-6 hover:border-[#c05c46] transition-colors" data-testid={`event-card-${e.event_id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="overline">{e.event_type}</span>
                    <h3 className="font-heading text-xl font-bold mt-1 tracking-tight">{e.title}</h3>
                  </div>
                  <Badge variant={e.status === "published" ? "default" : "secondary"} className={e.status === "published" ? "bg-[#4a5d4e]" : ""} data-testid={`event-status-${e.event_id}`}>
                    {e.status === "published" ? "Terbit" : "Draf"}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500 font-body">
                  <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {e.guest_count} tamu</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {e.config?.event_date || "-"}</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button onClick={() => navigate(`/events/${e.event_id}/edit`)} data-testid={`edit-event-${e.event_id}`} className="btn-ghost text-sm">Edit</button>
                  <button onClick={() => navigate(`/events/${e.event_id}/guests`)} data-testid={`guests-event-${e.event_id}`} className="btn-ghost text-sm">Tamu</button>
                  <button onClick={() => navigate(`/events/${e.event_id}/rsvp`)} data-testid={`rsvp-event-${e.event_id}`} className="btn-ghost text-sm">RSVP</button>
                  {e.status === "published" ? (
                    <Link to={`/inv/${e.slug}`} target="_blank" className="btn-ghost text-sm inline-flex items-center gap-1.5" data-testid={`open-inv-${e.event_id}`}>
                      Buka <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <button onClick={() => navigate(`/events/${e.event_id}/publish`)} data-testid={`publish-event-${e.event_id}`} className="btn-primary text-sm">Terbitkan</button>
                  )}
                  <button onClick={() => del(e.event_id)} data-testid={`delete-event-${e.event_id}`} className="ml-auto text-neutral-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
