import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import Header from "@/components/app/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Send, Trash2, FileUp } from "lucide-react";

export default function Guests() {
  const { eventId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [bulk, setBulk] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const [e, g] = await Promise.all([apiClient.get(`/events/${eventId}`), apiClient.get(`/events/${eventId}/guests`)]);
        setEvent(e.data);
        setGuests(g.data);
      } catch {
        toast.error("Gagal memuat");
      }
    })();
  }, [eventId]);

  const addOne = async () => {
    if (!name.trim()) return;
    try {
      const { data } = await apiClient.post(`/events/${eventId}/guests`, { guests: [{ name, whatsapp: wa }] });
      setGuests((g) => [...g, ...data]);
      setName("");
      setWa("");
      toast.success("Tamu ditambahkan");
    } catch {
      toast.error("Gagal menambahkan");
    }
  };

  const addBulk = async () => {
    const rows = bulk.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [n, w] = l.split(",").map((s) => s?.trim());
      return { name: n, whatsapp: w || "" };
    });
    if (rows.length === 0) return;
    try {
      const { data } = await apiClient.post(`/events/${eventId}/guests`, { guests: rows });
      setGuests((g) => [...g, ...data]);
      setBulk("");
      toast.success(`${data.length} tamu ditambahkan`);
    } catch {
      toast.error("Gagal impor");
    }
  };

  const del = async (id) => {
    await apiClient.delete(`/events/${eventId}/guests/${id}`);
    setGuests((g) => g.filter((x) => x.guest_id !== id));
  };

  const copyLink = (g) => {
    const url = `${window.location.origin}/inv/${event.slug}/${g.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link disalin");
  };

  const sendWA = async () => {
    if (event.status !== "published") {
      return toast.error("Terbitkan undangan terlebih dahulu");
    }
    setSending(true);
    try {
      const { data } = await apiClient.post(`/events/${eventId}/whatsapp/send`);
      toast.success(`(MOCK) ${data.sent_count} pesan WhatsApp dikirim`);
      const g2 = await apiClient.get(`/events/${eventId}/guests`);
      setGuests(g2.data);
    } catch (e) {
      toast.error("Gagal kirim WA");
    } finally {
      setSending(false);
    }
  };

  if (!event) return null;

  return (
    <div className="min-h-screen" data-testid="guests-page">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <span className="overline">Undangan · {event.title}</span>
        <div className="flex items-end justify-between flex-wrap gap-3 mt-2">
          <h1 className="font-heading text-4xl font-bold tracking-tight">Kelola Tamu</h1>
          <div className="flex gap-2">
            <button data-testid="btn-edit-back" onClick={() => navigate(`/events/${eventId}/edit`)} className="btn-ghost text-sm">Editor</button>
            <button data-testid="btn-send-wa" onClick={sendWA} disabled={sending} className="btn-primary text-sm" style={{ background: "#25d366" }}>
              <Send className="w-4 h-4" /> {sending ? "Mengirim..." : "Kirim via WhatsApp"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-[#e2dfd9] p-6 bg-white">
              <div className="overline">Tambah Satu</div>
              <div className="mt-4 space-y-3">
                <div>
                  <Label>Nama Tamu</Label>
                  <Input data-testid="input-guest-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bapak Budi" />
                </div>
                <div>
                  <Label>Nomor WhatsApp</Label>
                  <Input data-testid="input-guest-wa" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="+6281234567890" />
                </div>
                <button data-testid="btn-add-guest" onClick={addOne} className="btn-primary w-full justify-center text-sm">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-[#e2dfd9] p-6 bg-white">
              <div className="overline">Impor CSV</div>
              <p className="text-xs text-neutral-500 mt-2 font-body">Format: nama, nomor per baris</p>
              <textarea
                data-testid="input-bulk"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={5}
                className="w-full mt-3 px-3 py-2 border rounded-lg text-sm font-mono"
                placeholder="Pak Budi, +6281234567890&#10;Bu Ani, +6285678901234"
              />
              <button data-testid="btn-bulk-import" onClick={addBulk} className="btn-ghost w-full mt-3 text-sm justify-center">
                <FileUp className="w-4 h-4 mr-1.5" /> Impor
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-[#e2dfd9] bg-white overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b">
              <div className="overline">Daftar Tamu · {guests.length}</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>WA</TableHead>
                  <TableHead>RSVP</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-neutral-500 py-8">Belum ada tamu</TableCell></TableRow>
                ) : (
                  guests.map((g) => (
                    <TableRow key={g.guest_id} data-testid={`guest-row-${g.guest_id}`}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-sm text-neutral-500">{g.whatsapp || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={g.rsvp_status === "attending" ? "default" : g.rsvp_status === "not_attending" ? "destructive" : "secondary"}
                               className={g.rsvp_status === "attending" ? "bg-[#4a5d4e]" : ""}>
                          {g.rsvp_status === "attending" ? "Hadir" : g.rsvp_status === "not_attending" ? "Tidak" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button data-testid={`copy-link-${g.guest_id}`} onClick={() => copyLink(g)} className="p-1.5 hover:bg-neutral-100 rounded" title="Salin link">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button data-testid={`delete-guest-${g.guest_id}`} onClick={() => del(g.guest_id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
