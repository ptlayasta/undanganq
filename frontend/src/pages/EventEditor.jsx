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
import { Save, Users, Rocket, Image as ImageIcon, Music, X, Plus, Trash2, Sparkles } from "lucide-react";
import StockPicker from "@/components/app/StockPicker";

export default function EventEditor() {
  const { eventId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const galleryRef = useRef();
  const musicRef = useRef();
  const bridePhotoRef = useRef();
  const groomPhotoRef = useRef();
  const heroBgRef = useRef();
  const storyPhotoRef = useRef({});

  useEffect(() => { if (!loading && !user) navigate("/", { replace: true }); }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const [e, t] = await Promise.all([apiClient.get(`/events/${eventId}`), apiClient.get("/templates")]);
        setEvent(e.data);
        setConfig(e.data.config || {});
        setTemplates(t.data);
      } catch { toast.error("Undangan tidak ditemukan"); navigate("/dashboard"); }
    })();
  }, [eventId, navigate]);

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.patch(`/events/${eventId}`, { config });
      setEvent(data);
      toast.success("Perubahan disimpan");
    } catch { toast.error("Gagal menyimpan"); } finally { setSaving(false); }
  };

  const changeTemplate = async (template_id) => {
    try {
      const { data } = await apiClient.patch(`/events/${eventId}`, { template_id });
      setEvent(data);
      toast.success("Template diperbarui");
    } catch { toast.error("Gagal"); }
  };

  const uploadTo = async (file, cb) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await apiClient.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = `${API}/files/${data.file_id}`;
      cb(url);
      toast.success("Berhasil upload");
    } catch { toast.error("Upload gagal"); } finally { setUploading(false); }
  };

  const template = useMemo(() => templates.find((t) => t.template_id === event?.template_id), [templates, event]);
  if (!event) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#c05c46] border-t-transparent rounded-full animate-spin" /></div>;

  const isWedding = event.event_type === "wedding";
  const isAqiqah = event.event_type === "aqiqah";
  const eventType = event.event_type;

  const SECTIONS = [
    { key: "show_cover", label: "Halaman Sampul (Cover)" },
    { key: "show_verse", label: "Kutipan / Ayat" },
    { key: "show_couple", label: "Kartu Mempelai / Utama" },
    { key: "show_love_story", label: "Love Story / Timeline" },
    { key: "show_gallery", label: "Galeri Foto" },
    { key: "show_video", label: "Video" },
    { key: "show_countdown", label: "Countdown & Save the Date" },
    { key: "show_events", label: "Detail Acara + Maps" },
    { key: "show_gift", label: "Amplop Digital / Gift" },
    { key: "show_rsvp", label: "Form RSVP" },
    { key: "show_wishes", label: "Ucapan & Doa (Guestbook)" },
  ];
  const ORNAMENTS = [
    { key: "floral", label: "Floral" },
    { key: "botanical", label: "Botanical" },
    { key: "geometric", label: "Geometric" },
  ];

  // Helpers for arrays
  const addLoveStory = () => set("love_story", [...(config.love_story || []), { title: "", date: "", description: "", photo: "" }]);
  const updLoveStory = (i, k, v) => set("love_story", config.love_story.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delLoveStory = (i) => set("love_story", config.love_story.filter((_, j) => j !== i));

  const addEvent = () => set("events", [...(config.events || []), { name: "", date: "", time_start: "", time_end: "", venue: "", address: "", maps_url: "" }]);
  const updEvent = (i, k, v) => set("events", config.events.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delEvent = (i) => set("events", config.events.filter((_, j) => j !== i));

  const addBank = () => set("banks", [...(config.banks || []), { bank: "", account_number: "", account_name: "" }]);
  const updBank = (i, k, v) => set("banks", config.banks.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delBank = (i) => set("banks", config.banks.filter((_, j) => j !== i));

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

          <Accordion type="multiple" defaultValue={["basic"]} className="space-y-2" data-testid="editor-accordion">
            <AccordionItem value="basic" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Info Dasar</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {isWedding && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nama Panggilan Mempelai Wanita</Label><Input data-testid="input-bride" value={config.bride_name || ""} onChange={(e) => set("bride_name", e.target.value)} /></div>
                      <div><Label>Nama Panggilan Mempelai Pria</Label><Input data-testid="input-groom" value={config.groom_name || ""} onChange={(e) => set("groom_name", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nama Lengkap Wanita</Label><Input data-testid="input-bride-full" value={config.bride_full_name || ""} onChange={(e) => set("bride_full_name", e.target.value)} /></div>
                      <div><Label>Nama Lengkap Pria</Label><Input data-testid="input-groom-full" value={config.groom_full_name || ""} onChange={(e) => set("groom_full_name", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Orang Tua Wanita</Label><Input data-testid="input-bride-parents" value={config.bride_parents || ""} onChange={(e) => set("bride_parents", e.target.value)} /></div>
                      <div><Label>Orang Tua Pria</Label><Input data-testid="input-groom-parents" value={config.groom_parents || ""} onChange={(e) => set("groom_parents", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Instagram Wanita (username)</Label><Input data-testid="input-bride-ig" value={config.bride_instagram || ""} onChange={(e) => set("bride_instagram", e.target.value)} placeholder="@username" /></div>
                      <div><Label>Instagram Pria (username)</Label><Input data-testid="input-groom-ig" value={config.groom_instagram || ""} onChange={(e) => set("groom_instagram", e.target.value)} placeholder="@username" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Foto Mempelai Wanita</Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          {config.bride_photo && <img src={config.bride_photo} alt="" className="w-14 h-14 rounded-full object-cover" />}
                          <button data-testid="btn-upload-bride-photo" onClick={() => bridePhotoRef.current?.click()} className="btn-ghost text-sm">{config.bride_photo ? "Ganti" : "Upload"}</button>
                          <input ref={bridePhotoRef} type="file" accept="image/*" hidden onChange={(e) => uploadTo(e.target.files?.[0], (url) => set("bride_photo", url))} />
                        </div>
                      </div>
                      <div>
                        <Label>Foto Mempelai Pria</Label>
                        <div className="mt-1.5 flex items-center gap-3">
                          {config.groom_photo && <img src={config.groom_photo} alt="" className="w-14 h-14 rounded-full object-cover" />}
                          <button data-testid="btn-upload-groom-photo" onClick={() => groomPhotoRef.current?.click()} className="btn-ghost text-sm">{config.groom_photo ? "Ganti" : "Upload"}</button>
                          <input ref={groomPhotoRef} type="file" accept="image/*" hidden onChange={(e) => uploadTo(e.target.files?.[0], (url) => set("groom_photo", url))} />
                        </div>
                      </div>
                    </div>
                    <div><Label>Hashtag</Label><Input data-testid="input-hashtag" value={config.hashtag || ""} onChange={(e) => set("hashtag", e.target.value)} placeholder="#AnandaWedding2026" /></div>
                  </>
                )}
                {isAqiqah && (
                  <>
                    <div><Label>Nama Bayi</Label><Input data-testid="input-baby" value={config.baby_name || ""} onChange={(e) => set("baby_name", e.target.value)} /></div>
                    <div><Label>Orang Tua</Label><Input data-testid="input-parents" value={config.parents || ""} onChange={(e) => set("parents", e.target.value)} /></div>
                  </>
                )}
                {eventType === "khitanan" && (
                  <>
                    <div><Label>Nama Anak</Label><Input data-testid="input-child" value={config.child_name || ""} onChange={(e) => set("child_name", e.target.value)} /></div>
                    <div><Label>Orang Tua</Label><Input data-testid="input-khitanan-parents" value={config.parents || ""} onChange={(e) => set("parents", e.target.value)} /></div>
                  </>
                )}
                {eventType === "birthday" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nama yang Berulang Tahun</Label><Input data-testid="input-celebrant" value={config.celebrant || ""} onChange={(e) => set("celebrant", e.target.value)} /></div>
                      <div><Label>Umur</Label><Input data-testid="input-age" value={config.age || ""} onChange={(e) => set("age", e.target.value)} /></div>
                    </div>
                    <div><Label>Yang Mengundang</Label><Input data-testid="input-host" value={config.host || ""} onChange={(e) => set("host", e.target.value)} /></div>
                  </>
                )}
                {eventType === "engagement" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nama Wanita</Label><Input data-testid="input-eng-bride" value={config.bride_name || ""} onChange={(e) => set("bride_name", e.target.value)} /></div>
                    <div><Label>Nama Pria</Label><Input data-testid="input-eng-groom" value={config.groom_name || ""} onChange={(e) => set("groom_name", e.target.value)} /></div>
                  </div>
                )}
                {eventType === "graduation" && (
                  <>
                    <div><Label>Nama Wisudawan/wati</Label><Input data-testid="input-graduate" value={config.graduate_name || ""} onChange={(e) => set("graduate_name", e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Gelar</Label><Input data-testid="input-degree" value={config.degree || ""} onChange={(e) => set("degree", e.target.value)} /></div>
                      <div><Label>Universitas</Label><Input data-testid="input-university" value={config.university || ""} onChange={(e) => set("university", e.target.value)} /></div>
                    </div>
                  </>
                )}
                {eventType === "anniversary" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Nama Istri</Label><Input data-testid="input-ann-bride" value={config.bride_name || ""} onChange={(e) => set("bride_name", e.target.value)} /></div>
                    <div><Label>Nama Suami</Label><Input data-testid="input-ann-groom" value={config.groom_name || ""} onChange={(e) => set("groom_name", e.target.value)} /></div>
                    <div><Label>Tahun ke-</Label><Input data-testid="input-years" value={config.years || ""} onChange={(e) => set("years", e.target.value)} /></div>
                  </div>
                )}
                {eventType === "baby_shower" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nama Ibu</Label><Input data-testid="input-mother" value={config.mother_name || ""} onChange={(e) => set("mother_name", e.target.value)} /></div>
                    <div><Label>Nama Ayah</Label><Input data-testid="input-father" value={config.father_name || ""} onChange={(e) => set("father_name", e.target.value)} /></div>
                  </div>
                )}
                {eventType === "syukuran" && (
                  <>
                    <div><Label>Nama Tuan Rumah</Label><Input data-testid="input-host-name" value={config.host_name || ""} onChange={(e) => set("host_name", e.target.value)} /></div>
                    <div><Label>Occasion</Label><Input data-testid="input-occasion" value={config.occasion || ""} onChange={(e) => set("occasion", e.target.value)} placeholder="Syukuran Rumah Baru" /></div>
                  </>
                )}
                {eventType === "corporate" && (
                  <>
                    <div><Label>Nama Perusahaan</Label><Input data-testid="input-company" value={config.company_name || ""} onChange={(e) => set("company_name", e.target.value)} /></div>
                    <div><Label>Nama Acara</Label><Input data-testid="input-event-name" value={config.event_name || ""} onChange={(e) => set("event_name", e.target.value)} /></div>
                  </>
                )}
                {!["wedding", "aqiqah", "khitanan", "birthday", "engagement", "graduation", "anniversary", "baby_shower", "syukuran", "corporate"].includes(eventType) && (
                  <div><Label>Nama Perayaan</Label><Input data-testid="input-celebrant" value={config.celebrant || ""} onChange={(e) => set("celebrant", e.target.value)} /></div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="hero" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Sampul (Hero)</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label>Label Atas (contoh: &quot;The Wedding of&quot;, &quot;Khitanan&quot;, dsb)</Label>
                  <Input
                    data-testid="input-hero-label"
                    value={config.hero_label ?? ""}
                    onChange={(e) => set("hero_label", e.target.value)}
                    placeholder="Kosongkan untuk pakai default sesuai jenis acara"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Kosong = otomatis dari jenis acara.</p>
                </div>
                <div>
                  <Label>Gambar Latar Belakang (opsional)</Label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {config.hero_bg && <img src={config.hero_bg} alt="" className="w-16 h-16 rounded object-cover border" />}
                    <input type="file" accept="image/*" hidden ref={heroBgRef} onChange={(e) => uploadTo(e.target.files?.[0], (url) => set("hero_bg", url))} />
                    <button data-testid="btn-upload-hero-bg" onClick={() => heroBgRef.current?.click()} className="btn-ghost text-sm">
                      <ImageIcon className="w-4 h-4 mr-1.5" /> {config.hero_bg ? "Ganti" : "Upload"}
                    </button>
                    <button data-testid="btn-open-stock" onClick={() => setStockOpen(true)} className="btn-primary text-sm">
                      <Sparkles className="w-4 h-4" /> Pilih dari Galeri
                    </button>
                    {config.hero_bg && (
                      <button data-testid="btn-remove-hero-bg" onClick={() => set("hero_bg", "")} className="text-xs text-red-500 hover:underline">
                        Hapus
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">Tidak punya foto? Pilih dari galeri kurasi (bunga, Bali, batik, dsb).</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Warna Tulisan Sampul</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        data-testid="input-hero-text-color"
                        type="color"
                        value={config.hero_text_color || "#ffffff"}
                        onChange={(e) => set("hero_text_color", e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={config.hero_text_color || ""}
                        onChange={(e) => set("hero_text_color", e.target.value)}
                        placeholder="Otomatis"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Gelap Overlay ({config.hero_overlay_opacity ?? 45}%)</Label>
                    <input
                      data-testid="input-hero-overlay"
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={config.hero_overlay_opacity ?? 45}
                      onChange={(e) => set("hero_overlay_opacity", Number(e.target.value))}
                      disabled={!config.hero_bg}
                      className="w-full mt-3 accent-[#c05c46]"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Hanya aktif jika ada gambar latar.</p>
                  </div>
                </div>
                {config.hero_text_color && (
                  <button
                    data-testid="btn-reset-hero-color"
                    onClick={() => set("hero_text_color", "")}
                    className="text-xs text-neutral-500 hover:text-red-500"
                  >
                    Reset ke warna default template
                  </button>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sections" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Bagian yang Ditampilkan</AccordionTrigger>
              <AccordionContent className="pt-2">
                <p className="text-xs text-neutral-500 mb-3">Aktifkan/nonaktifkan bagian sesuai kebutuhan. Data yang sudah diisi tetap tersimpan.</p>
                <div className="grid grid-cols-2 gap-2">
                  {SECTIONS.map((s) => {
                    const active = config[s.key] !== false;
                    return (
                      <label key={s.key} data-testid={`toggle-${s.key}`}
                             className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${active ? "border-[#c05c46] bg-[#faf3ef]" : "border-[#e2dfd9] bg-white"}`}>
                        <span className="text-sm">{s.label}</span>
                        <input type="checkbox" checked={active} onChange={(e) => set(s.key, e.target.checked)} className="accent-[#c05c46] w-4 h-4" />
                      </label>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ornament" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Ornamen Dekoratif</AccordionTrigger>
              <AccordionContent className="pt-2">
                <p className="text-xs text-neutral-500 mb-3">Pilih gaya ornamen yang digunakan di semua bagian undangan.</p>
                <div className="grid grid-cols-3 gap-3">
                  {ORNAMENTS.map((o) => {
                    const active = (config.ornament_set || "floral") === o.key;
                    return (
                      <button key={o.key} data-testid={`ornament-${o.key}`} onClick={() => set("ornament_set", o.key)}
                              className={`p-4 rounded-xl border-2 transition-colors ${active ? "border-[#c05c46] bg-[#faf3ef]" : "border-[#e2dfd9]"}`}>
                        <div className="text-sm font-semibold">{o.label}</div>
                        <div className="text-[10px] text-neutral-500 mt-1">{o.key === "floral" ? "Bunga & titik lembut" : o.key === "botanical" ? "Daun & sulur" : "Garis & geometri"}</div>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            {isWedding && (
              <AccordionItem value="verse" className="border rounded-xl px-4 bg-white">
                <AccordionTrigger className="font-heading font-semibold">Kutipan / Ayat Pembuka</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div><Label>Teks Kutipan</Label><Textarea rows={3} data-testid="input-verse-text" value={config.verse_text || ""} onChange={(e) => set("verse_text", e.target.value)} /></div>
                  <div><Label>Referensi</Label><Input data-testid="input-verse-ref" value={config.verse_ref || ""} onChange={(e) => set("verse_ref", e.target.value)} placeholder="Jeremiah 29:11" /></div>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="events" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Acara ({(config.events || []).length})</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {(config.events || []).map((ev, i) => (
                  <div key={i} className="rounded-lg border p-3 bg-neutral-50 space-y-2" data-testid={`event-block-${i}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-500">Acara #{i + 1}</span>
                      <button onClick={() => delEvent(i)} data-testid={`btn-del-event-${i}`} className="text-neutral-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input data-testid={`event-name-${i}`} placeholder="Nama (Akad/Resepsi)" value={ev.name} onChange={(e) => updEvent(i, "name", e.target.value)} />
                      <Input data-testid={`event-date-${i}`} type="date" value={ev.date} onChange={(e) => updEvent(i, "date", e.target.value)} />
                      <Input data-testid={`event-time-start-${i}`} type="time" value={ev.time_start} onChange={(e) => updEvent(i, "time_start", e.target.value)} />
                      <Input data-testid={`event-time-end-${i}`} type="time" value={ev.time_end} onChange={(e) => updEvent(i, "time_end", e.target.value)} />
                    </div>
                    <Input data-testid={`event-venue-${i}`} placeholder="Venue" value={ev.venue} onChange={(e) => updEvent(i, "venue", e.target.value)} />
                    <Input data-testid={`event-address-${i}`} placeholder="Alamat" value={ev.address} onChange={(e) => updEvent(i, "address", e.target.value)} />
                    <Input data-testid={`event-maps-${i}`} placeholder="Google Maps URL" value={ev.maps_url} onChange={(e) => updEvent(i, "maps_url", e.target.value)} />
                  </div>
                ))}
                <button data-testid="btn-add-event" onClick={addEvent} className="btn-ghost text-sm w-full justify-center"><Plus className="w-4 h-4 mr-1" /> Tambah Acara</button>
              </AccordionContent>
            </AccordionItem>

            {isWedding && (
              <AccordionItem value="story" className="border rounded-xl px-4 bg-white">
                <AccordionTrigger className="font-heading font-semibold">Love Story ({(config.love_story || []).length})</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  {(config.love_story || []).map((s, i) => (
                    <div key={i} className="rounded-lg border p-3 bg-neutral-50 space-y-2" data-testid={`story-block-${i}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-500">Bab #{i + 1}</span>
                        <button onClick={() => delLoveStory(i)} data-testid={`btn-del-story-${i}`} className="text-neutral-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input data-testid={`story-title-${i}`} placeholder="Judul (First Meet)" value={s.title} onChange={(e) => updLoveStory(i, "title", e.target.value)} />
                        <Input data-testid={`story-date-${i}`} placeholder="Waktu (2021)" value={s.date} onChange={(e) => updLoveStory(i, "date", e.target.value)} />
                      </div>
                      <Textarea data-testid={`story-desc-${i}`} rows={2} placeholder="Cerita" value={s.description} onChange={(e) => updLoveStory(i, "description", e.target.value)} />
                      <div className="flex items-center gap-2">
                        {s.photo && <img src={s.photo} alt="" className="w-14 h-14 object-cover rounded" />}
                        <input type="file" accept="image/*" hidden ref={(el) => (storyPhotoRef.current[i] = el)} onChange={(e) => uploadTo(e.target.files?.[0], (url) => updLoveStory(i, "photo", url))} />
                        <button data-testid={`btn-story-photo-${i}`} onClick={() => storyPhotoRef.current[i]?.click()} className="btn-ghost text-xs">{s.photo ? "Ganti Foto" : "Upload Foto"}</button>
                      </div>
                    </div>
                  ))}
                  <button data-testid="btn-add-story" onClick={addLoveStory} className="btn-ghost text-sm w-full justify-center"><Plus className="w-4 h-4 mr-1" /> Tambah Bab</button>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="media" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Galeri, Musik & Video</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label>Galeri Foto ({(config.gallery || []).length})</Label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(config.gallery || []).map((url, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button data-testid={`remove-photo-${i}`} onClick={() => set("gallery", config.gallery.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/70 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
                      </div>
                    ))}
                    <button data-testid="btn-upload-photo" onClick={() => galleryRef.current?.click()} className="w-24 h-24 rounded-lg border-2 border-dashed border-[#e2dfd9] flex flex-col items-center justify-center text-neutral-500 hover:border-[#c05c46]">
                      <ImageIcon className="w-5 h-5" /><span className="text-xs mt-1">Tambah</span>
                    </button>
                    <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => uploadTo(e.target.files?.[0], (url) => set("gallery", [...(config.gallery || []), url]))} />
                  </div>
                </div>
                <div>
                  <Label>Musik Latar</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {config.music_url && <audio controls src={config.music_url} className="max-w-full" data-testid="music-preview" />}
                    <button data-testid="btn-upload-music" onClick={() => musicRef.current?.click()} className="btn-ghost text-sm"><Music className="w-4 h-4 mr-1.5" /> {config.music_url ? "Ganti" : "Upload"}</button>
                    <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => uploadTo(e.target.files?.[0], (url) => set("music_url", url))} />
                  </div>
                </div>
                <div>
                  <Label>Video Prewedding (URL YouTube)</Label>
                  <Input data-testid="input-video" value={config.video_url || ""} onChange={(e) => set("video_url", e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                </div>
                {uploading && <div className="text-sm text-neutral-500">Mengunggah...</div>}
              </AccordionContent>
            </AccordionItem>

            {(config.banks !== undefined || eventType === "wedding" || eventType === "engagement" || eventType === "anniversary") && (
              <AccordionItem value="gift" className="border rounded-xl px-4 bg-white">
                <AccordionTrigger className="font-heading font-semibold">Amplop Digital (Bank)</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  {(config.banks || []).map((b, i) => (
                    <div key={i} className="rounded-lg border p-3 bg-neutral-50 space-y-2" data-testid={`bank-block-${i}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-500">Rekening #{i + 1}</span>
                        <button onClick={() => delBank(i)} data-testid={`btn-del-bank-${i}`} className="text-neutral-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input data-testid={`bank-name-${i}`} placeholder="BCA" value={b.bank} onChange={(e) => updBank(i, "bank", e.target.value)} />
                        <Input data-testid={`bank-number-${i}`} placeholder="1234567890" value={b.account_number} onChange={(e) => updBank(i, "account_number", e.target.value)} />
                        <Input data-testid={`bank-owner-${i}`} placeholder="Nama Pemilik" value={b.account_name} onChange={(e) => updBank(i, "account_name", e.target.value)} />
                      </div>
                    </div>
                  ))}
                  <button data-testid="btn-add-bank" onClick={addBank} className="btn-ghost text-sm w-full justify-center"><Plus className="w-4 h-4 mr-1" /> Tambah Rekening</button>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="pesan" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Pesan Pembuka</AccordionTrigger>
              <AccordionContent className="pt-2">
                <Textarea rows={3} data-testid="input-story" value={config.story || ""} onChange={(e) => set("story", e.target.value)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="template" className="border rounded-xl px-4 bg-white">
              <AccordionTrigger className="font-heading font-semibold">Ganti Template</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="grid grid-cols-3 gap-3">
                  {templates.filter((t) => t.category === event.event_type).map((t) => (
                    <button key={t.template_id} data-testid={`switch-template-${t.template_id}`} onClick={() => changeTemplate(t.template_id)}
                            className={`rounded-lg overflow-hidden border-2 ${event.template_id === t.template_id ? "border-[#c05c46]" : "border-transparent"}`}>
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
      <StockPicker
        open={stockOpen}
        onOpenChange={setStockOpen}
        currentUrl={config.hero_bg}
        onPick={(url) => set("hero_bg", url)}
      />
    </div>
  );
}
