import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import Header from "@/components/app/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check } from "lucide-react";

export default function NewEvent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(params.get("template") || null);
  const [selectedType, setSelectedType] = useState(params.get("type") || "wedding");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/", { replace: true }); }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      const [t, e] = await Promise.all([apiClient.get("/templates"), apiClient.get("/event-types")]);
      setTemplates(t.data);
      setEventTypes(e.data);
    })();
  }, []);

  const filtered = templates.filter((t) => t.category === selectedType);

  const submit = async () => {
    if (!title.trim()) return toast.error("Judul undangan wajib diisi");
    if (!selectedTemplate) return toast.error("Pilih template");
    setBusy(true);
    try {
      const { data } = await apiClient.post("/events", {
        title, event_type: selectedType, template_id: selectedTemplate,
      });
      toast.success("Undangan dibuat");
      navigate(`/events/${data.event_id}/edit`);
    } catch { toast.error("Gagal membuat undangan"); } finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen" data-testid="new-event-page">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <span className="overline">Langkah 1 dari 3</span>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight mt-2">Buat undangan baru</h1>
        <p className="text-neutral-500 mt-2 font-body">Pilih jenis acara dan template favorit Anda.</p>

        <div className="grid lg:grid-cols-3 gap-8 mt-10">
          <div className="lg:col-span-2">
            <Tabs value={selectedType} onValueChange={(v) => { setSelectedType(v); setSelectedTemplate(null); }}>
              <TabsList className="flex-wrap h-auto" data-testid="type-tabs">
                {eventTypes.map((c) => (
                  <TabsTrigger key={c.key} value={c.key} data-testid={`tab-${c.key}`}>{c.label}</TabsTrigger>
                ))}
              </TabsList>
              {eventTypes.map((c) => (
                <TabsContent key={c.key} value={c.key} className="mt-6">
                  {filtered.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-8 text-center border border-dashed rounded-lg">Belum ada template untuk kategori ini.</div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {filtered.map((t) => (
                        <button
                          key={t.template_id}
                          data-testid={`template-${t.template_id}`}
                          onClick={() => setSelectedTemplate(t.template_id)}
                          className={`text-left rounded-2xl border overflow-hidden transition-all ${
                            selectedTemplate === t.template_id
                              ? "border-[#c05c46] ring-2 ring-[#c05c46]/20"
                              : "border-[#e2dfd9] hover:border-neutral-400"
                          }`}
                        >
                          <div className="relative h-44">
                            <img src={t.cover} alt={t.name} className="w-full h-full object-cover" />
                            {selectedTemplate === t.template_id && (
                              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#c05c46] flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                            {t.tier === "paid" && (
                              <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-[#d4af37] text-black font-bold">Premium</span>
                            )}
                          </div>
                          <div className="p-4 bg-white">
                            <div className="overline">{c.label}</div>
                            <h3 className="font-heading font-bold text-lg mt-1">{t.name}</h3>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-[#e2dfd9] p-6 bg-white sticky top-24">
              <span className="overline">Detail Undangan</span>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="title">Judul Undangan</Label>
                  <Input
                    id="title"
                    data-testid="input-event-title"
                    placeholder="Andi & Rina — Pernikahan"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="text-xs text-neutral-500 font-body">Slug URL akan dibuat otomatis dan bisa disesuaikan nanti.</div>
                <button data-testid="btn-create-event" disabled={busy || !title || !selectedTemplate} onClick={submit} className="btn-primary w-full justify-center">
                  {busy ? "Membuat..." : "Buat & Lanjut ke Editor"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
