import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiClient, API } from "@/lib/api";
import Header from "@/components/app/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import InvitationRenderer from "@/components/app/InvitationRenderer";
import { Save, Users, Rocket, Image as ImageIcon, Music, X } from "lucide-react";

export default function EventEditor() {
  const { eventId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const musicRef = useRef();

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const [e, t] = await Promise.all([apiClient.get(`/events/${eventId}`), apiClient.get("/templates")]);
        setEvent(e.data);
        setConfig(e.data.config || {});
        setTemplates(t.data);
      } catch {
        toast.error("Undangan tidak ditemukan");
        navigate("/dashboard");
      }
    })();
  }, [eventId, navigate]);

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.patch(`/events/${eventId}`, { config });
      setEvent(data);
      toast.success("Perubahan disimpan");
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const changeTemplate = async (template_id) => {
    try {
      const { data } = await apiClient.patch(`/events/${eventId}`, { template_id });
      setEvent(data);
      toast.success("Template diperbarui");
    } catch {
      toast.error("Gagal");
    }
  };

  const upload = async (file, kind) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await apiClient.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = `${API}/files/${data.file_id}`;
      if (kind === "gallery") set("gallery", [...(config.gallery || []), url]);
      else if (kind === "music") set("music_url", url);
      toast.success("Berhasil upload");
    } catch {
      toast.error("Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const template = useMemo(() => templates.find((t) => t.template_id === event?.template_id), [templates, event]);

  if (!event) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#c05c46] border-t-transparent rounded-full animate-spin" /></div>;

  const isWedding = event.event_type === "wedding";
  const isAqiqah = event.event_type === "aqiqah";

  return (
    <div className="min-h-screen" data-testid="event-editor-page">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <span className="overline">Editor · {event.event_type}</span>
              <h1 className="font-heading text-3xl font-bold tracking-tight mt-1">{event.title}</h1>
            </div>
            <div className="flex gap-2">
              <button data-testid="btn-save" onClick={save} disabled={saving} className="btn-ghost text-sm">
                <Save className="w-4 h-4 mr-1.5" /> {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button data-testid="btn-goto-guests" onClick={() => navigate(`/events/${eventId}/guests`)} className="btn-ghost text-sm">
                <Users className="w-4 h-4 mr-1.5" /> Tamu
              </button>
              <button data-testid="btn-goto-publish" onClick={() => navigate(`/events/${eventId}/publish`)} className="btn-primary text-sm">
                <Rocket className="w-4 h-4" /> Terbitkan
              </button>
            </div>
          </div>

          <Accordion type="multiple" defaultValue={["basic", "details"]} className="space-y-2" data-testid="editor-accordion">
            <AccordionItem value="basic" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Informasi Dasar</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {isWedding && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nama Mempelai Wanita</Label>
                      <Input data-testid="input-bride" value={config.bride_name || ""} onChange={(e) => set("bride_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>Nama Mempelai Pria</Label>
                      <Input data-testid="input-groom" value={config.groom_name || ""} onChange={(e) => set("groom_name", e.target.value)} />
                    </div>
                  </div>
                )}
                {isAqiqah && (
                  <>
                    <div>
                      <Label>Nama Bayi</Label>
                      <Input data-testid="input-baby" value={config.baby_name || ""} onChange={(e) => set("baby_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>Orang Tua</Label>
                      <Input data-testid="input-parents" value={config.parents || ""} onChange={(e) => set("parents", e.target.value)} />
                    </div>
                  </>
                )}
                {!isWedding && !isAqiqah && (
                  <div>
                    <Label>Nama Perayaan</Label>
                    <Input data-testid="input-celebrant" value={config.celebrant || ""} onChange={(e) => set("celebrant", e.target.value)} />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="details" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Waktu & Tempat</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tanggal Acara</Label>
                    <Input type="date" data-testid="input-date" value={config.event_date || ""} onChange={(e) => set("event_date", e.target.value)} />
                  </div>
                  <div>
                    <Label>Waktu</Label>
                    <Input type="time" data-testid="input-time" value={config.event_time || ""} onChange={(e) => set("event_time", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Tempat</Label>
                  <Input data-testid="input-venue" value={config.venue || ""} onChange={(e) => set("venue", e.target.value)} />
                </div>
                <div>
                  <Label>Alamat</Label>
                  <Textarea rows={2} data-testid="input-address" value={config.venue_address || ""} onChange={(e) => set("venue_address", e.target.value)} />
                </div>
                <div>
                  <Label>Pesan / Kutipan</Label>
                  <Textarea rows={3} data-testid="input-story" value={config.story || ""} onChange={(e) => set("story", e.target.value)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="media" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Foto & Musik</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label>Galeri Foto</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(config.gallery || []).map((url, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          data-testid={`remove-photo-${i}`}
                          onClick={() => set("gallery", config.gallery.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 bg-black/70 rounded-full p-1"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <button
                      data-testid="btn-upload-photo"
                      onClick={() => fileRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-[#e2dfd9] flex flex-col items-center justify-center text-neutral-500 hover:border-[#c05c46]"
                    >
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-xs mt-1">Tambah</span>
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], "gallery")} />
                  </div>
                </div>
                <div>
                  <Label>Musik Latar</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {config.music_url && (
                      <audio controls src={config.music_url} className="max-w-full" data-testid="music-preview" />
                    )}
                    <button
                      data-testid="btn-upload-music"
                      onClick={() => musicRef.current?.click()}
                      className="btn-ghost text-sm"
                    >
                      <Music className="w-4 h-4 mr-1.5" /> {config.music_url ? "Ganti" : "Upload"}
                    </button>
                    <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => upload(e.target.files?.[0], "music")} />
                  </div>
                </div>
                {uploading && <div className="text-sm text-neutral-500">Mengunggah...</div>}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="template" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Ganti Template</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid grid-cols-3 gap-3">
                  {templates.filter((t) => t.category === event.event_type).map((t) => (
                    <button
                      key={t.template_id}
                      data-testid={`switch-template-${t.template_id}`}
                      onClick={() => changeTemplate(t.template_id)}
                      className={`rounded-lg overflow-hidden border-2 ${event.template_id === t.template_id ? "border-[#c05c46]" : "border-transparent"}`}
                    >
                      <img src={t.cover} alt={t.name} className="w-full h-24 object-cover" />
                      <div className="p-2 text-xs font-medium text-left">{t.name}</div>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <aside className="lg:col-span-5">
          <div className="sticky top-24">
            <span className="overline">Preview Mobile</span>
            <div className="mt-3 flex justify-center">
              <div className="phone-frame">
                <div className="phone-inner">
                  <InvitationRenderer event={{ ...event, config }} template={template} guest={{ name: "Bapak/Ibu Tamu" }} preview />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
