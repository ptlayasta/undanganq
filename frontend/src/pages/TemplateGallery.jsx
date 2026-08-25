import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth, loginWithGoogle } from "@/lib/auth";
import Header from "@/components/app/Header";
import InvitationRenderer from "@/components/app/InvitationRenderer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Eye, ChevronRight, Lock } from "lucide-react";

/**
 * Public template gallery — browse and preview without login.
 * Login required to actually create an event.
 */
export default function TemplateGallery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    (async () => {
      const [t, e] = await Promise.all([apiClient.get("/templates"), apiClient.get("/event-types")]);
      setTemplates(t.data);
      setTypes(e.data);
    })();
  }, []);

  const filtered = selectedType === "all" ? templates : templates.filter((t) => t.category === selectedType);
  const startCreate = (tpl) => {
    if (user) navigate(`/events/new?template=${tpl.template_id}&type=${tpl.category}`);
    else loginWithGoogle();
  };

  return (
    <div className="min-h-screen inv-bg" data-testid="template-gallery-page">
      <Header variant="landing" />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <span className="overline">Galeri Template</span>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight mt-2">Pilih template favorit Anda</h1>
            <p className="text-neutral-500 mt-2 font-body max-w-2xl">
              Lihat contoh undangan sebelum membuat. Login diperlukan untuk memulai — tapi Anda bisa preview semua template gratis di sini.
            </p>
          </div>
        </div>

        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <TabsList className="flex-wrap h-auto p-1" data-testid="type-filter">
            <TabsTrigger value="all" data-testid="tab-all">Semua</TabsTrigger>
            {types.map((t) => (
              <TabsTrigger key={t.key} value={t.key} data-testid={`tab-${t.key}`}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="template-grid">
          {filtered.map((t) => (
            <div key={t.template_id} className="rounded-2xl overflow-hidden bg-white border border-[#e2dfd9] group" data-testid={`tpl-card-${t.template_id}`}>
              <div className="relative h-56 overflow-hidden">
                <img src={t.cover} alt={t.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {t.tier === "paid" && (
                  <Badge className="absolute top-3 left-3 bg-[#d4af37] text-black font-bold">Premium</Badge>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Link to={`/templates/${t.template_id}/preview`} data-testid={`tpl-preview-${t.template_id}`} className="btn-primary text-sm">
                    <Eye className="w-4 h-4" /> Preview
                  </Link>
                </div>
              </div>
              <div className="p-5">
                <div className="overline">{types.find((x) => x.key === t.category)?.label || t.category}</div>
                <h3 className="font-heading text-xl font-bold mt-1 tracking-tight">{t.name}</h3>
                <div className="mt-4 flex items-center gap-2">
                  <Link to={`/templates/${t.template_id}/preview`} className="btn-ghost text-sm flex-1 justify-center">
                    <Eye className="w-4 h-4 mr-1.5" /> Preview
                  </Link>
                  <button onClick={() => startCreate(t)} data-testid={`tpl-use-${t.template_id}`} className="btn-primary text-sm flex-1 justify-center">
                    {user ? <>Gunakan <ChevronRight className="w-4 h-4" /></> : <><Lock className="w-3.5 h-3.5" /> Login</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!user && (
          <div className="mt-12 rounded-3xl bg-[#1a1a1a] text-white p-8 text-center">
            <div className="overline" style={{ color: "#d4af37" }}>Siap Mulai?</div>
            <h3 className="font-heading text-3xl font-bold mt-3">Login untuk membuat undangan Anda</h3>
            <p className="text-white/70 mt-2 max-w-xl mx-auto text-sm">
              Gratis untuk membuat draf. Bayar hanya saat Anda siap menerbitkan versi Premium.
            </p>
            <button data-testid="cta-login-gallery" onClick={loginWithGoogle} className="btn-primary mt-6">
              Masuk dengan Google <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}


export function TemplatePreview() {
  const { templateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [sampleEvent, setSampleEvent] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: templates } = await apiClient.get("/templates");
      const t = templates.find((x) => x.template_id === templateId);
      if (!t) return;
      setTemplate(t);
      // Build sample event using backend defaults via an unauthenticated GET
      // We'll construct a client-side sample from category
      setSampleEvent({
        event_type: t.category,
        template_id: t.template_id,
        title: `Sample ${t.name}`,
        config: sampleConfigFor(t.category, t),
      });
    })();
  }, [templateId]);

  const start = () => {
    if (user) navigate(`/events/new?template=${templateId}&type=${template.category}`);
    else loginWithGoogle();
  };

  if (!template) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#c05c46] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen" data-testid="template-preview-page" style={{ background: template.theme?.bg || "#f9f8f6" }}>
      <div className="glass sticky top-0 z-40 border-b border-[#e2dfd9]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/templates" className="text-sm text-neutral-600 hover:text-black" data-testid="back-to-gallery">← Kembali ke Galeri</Link>
          <div className="text-center">
            <div className="overline">{template.category}</div>
            <div className="font-heading font-bold">{template.name}</div>
          </div>
          <button data-testid="btn-use-template" onClick={start} className="btn-primary text-sm">
            {user ? "Gunakan Template" : "Login untuk Gunakan"} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <main className="max-w-md mx-auto shadow-2xl relative">
        <InvitationRenderer event={sampleEvent} template={template} guest={{ name: "Bapak/Ibu Tamu" }} preview />
      </main>
    </div>
  );
}

function sampleConfigFor(category, template) {
  const ornament = template.theme?.ornament || "floral";
  const base = { ornament_set: ornament, show_cover: true, show_verse: true, show_couple: true, show_love_story: true, show_gallery: false, show_video: false, show_countdown: true, show_events: true, show_gift: true, show_wishes: true, show_rsvp: true };
  if (category === "wedding") return { ...base, bride_name: "Rina", groom_name: "Andi", hashtag: "#RinaAndi2026", bride_full_name: "Rina Sari", groom_full_name: "Andi Pratama", bride_parents: "Bpk. Sudirman & Ibu Wati", groom_parents: "Bpk. Hasan & Ibu Sri", verse_text: "Cinta adalah anugerah terindah dari Tuhan.", verse_ref: "1 Korintus 13:4", event_date: "2026-06-15", events: [{ name: "Akad Nikah", date: "2026-06-15", time_start: "10:00", time_end: "12:00", venue: "Masjid Al-Falah", address: "Jl. Sudirman, Jakarta", maps_url: "" }, { name: "Resepsi", date: "2026-06-15", time_start: "19:00", time_end: "21:00", venue: "Grand Ballroom", address: "Hotel Mulia, Jakarta", maps_url: "" }], love_story: [{ title: "First Meet", date: "2022", description: "Bertemu di sebuah kafe di sore hari.", photo: "" }, { title: "The Journey", date: "2023-2025", description: "Melewati suka duka bersama, saling menguatkan.", photo: "" }], banks: [{ bank: "BCA", account_number: "1234567890", account_name: "Rina Sari" }] };
  if (category === "engagement") return { ...base, bride_name: "Rina", groom_name: "Andi", hashtag: "#RinaAndiEngaged", show_love_story: false, show_gift: false, event_date: "2026-05-10", events: [{ name: "Tunangan", date: "2026-05-10", time_start: "10:00", time_end: "12:00", venue: "Kediaman", address: "Jakarta", maps_url: "" }] };
  if (category === "aqiqah") return { ...base, baby_name: "Muhammad Adam", parents: "Ahmad & Siti", show_couple: false, show_love_story: false, event_date: "2026-04-10", events: [{ name: "Aqiqah", date: "2026-04-10", time_start: "09:00", time_end: "11:00", venue: "Kediaman", address: "Jl. Kenanga, Jakarta", maps_url: "" }] };
  if (category === "khitanan") return { ...base, child_name: "Muhammad Farhan", parents: "Ahmad & Siti", show_couple: false, show_love_story: false, event_date: "2026-04-10", events: [{ name: "Khitanan", date: "2026-04-10", time_start: "10:00", time_end: "13:00", venue: "Kediaman", address: "Bandung", maps_url: "" }] };
  if (category === "birthday") return { ...base, celebrant: "Nabila", age: "5", host: "Papa & Mama", show_couple: false, show_love_story: false, show_verse: false, event_date: "2026-05-20", events: [{ name: "Ulang Tahun ke-5", date: "2026-05-20", time_start: "18:00", time_end: "21:00", venue: "Rumah", address: "", maps_url: "" }] };
  if (category === "graduation") return { ...base, graduate_name: "Andi Pratama, S.Kom", degree: "Sarjana Komputer", university: "Universitas Indonesia", show_couple: false, show_love_story: false, show_gift: false, event_date: "2026-07-01", events: [{ name: "Syukuran Wisuda", date: "2026-07-01", time_start: "18:00", time_end: "21:00", venue: "Restoran Sederhana", address: "Jakarta", maps_url: "" }] };
  if (category === "anniversary") return { ...base, bride_name: "Rina", groom_name: "Andi", years: "10", event_date: "2026-06-15", events: [{ name: "Anniversary Dinner", date: "2026-06-15", time_start: "19:00", time_end: "22:00", venue: "Skye Restaurant", address: "Jakarta", maps_url: "" }] };
  if (category === "baby_shower") return { ...base, mother_name: "Rina", father_name: "Andi", show_couple: false, show_love_story: false, show_gift: false, event_date: "2026-06-15", events: [{ name: "Baby Shower", date: "2026-06-15", time_start: "14:00", time_end: "17:00", venue: "Kediaman", address: "Jakarta", maps_url: "" }] };
  if (category === "syukuran") return { ...base, host_name: "Keluarga Ahmad", occasion: "Syukuran Rumah Baru", show_couple: false, show_love_story: false, show_gift: false, event_date: "2026-05-01", events: [{ name: "Syukuran", date: "2026-05-01", time_start: "18:00", time_end: "21:00", venue: "Kediaman", address: "Jakarta", maps_url: "" }] };
  if (category === "corporate") return { ...base, event_name: "Annual Gala 2026", company_name: "PT Contoh Indonesia", show_couple: false, show_love_story: false, show_verse: false, show_gift: false, event_date: "2026-11-15", events: [{ name: "Gala Dinner", date: "2026-11-15", time_start: "18:00", time_end: "22:00", venue: "Hotel Ballroom", address: "Jakarta", maps_url: "" }] };
  return base;
}
