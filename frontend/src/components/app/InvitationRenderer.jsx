import { useMemo } from "react";
import { Calendar, MapPin, Music2 } from "lucide-react";

/**
 * Renders a public/preview invitation using event.config + selected template theme.
 * Works for wedding, aqiqah, birthday, corporate.
 */
export default function InvitationRenderer({ event, template, guest, preview = false }) {
  const cfg = event?.config || {};
  const theme = template?.theme || { primary: "#c05c46", accent: "#d4af37", bg: "#f9f8f6", font_heading: "Cormorant Garamond" };

  const dateFormatted = useMemo(() => {
    if (!cfg.event_date) return "";
    try {
      return new Date(cfg.event_date).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch {
      return cfg.event_date;
    }
  }, [cfg.event_date]);

  const isDark = theme.bg && (theme.bg.startsWith("#1") || theme.bg === "#1a1410");
  const textColor = isDark ? "#f4ecdd" : "#1a1a1a";
  const mutedColor = isDark ? "#c2b299" : "#5c5854";

  const heroTitle = event?.event_type === "wedding"
    ? `${cfg.bride_name || "Bride"} & ${cfg.groom_name || "Groom"}`
    : event?.event_type === "aqiqah"
    ? cfg.baby_name || "Nama Bayi"
    : cfg.celebrant || cfg.title || event?.title || "Acara Kami";

  const label = event?.event_type === "wedding"
    ? "The Wedding of"
    : event?.event_type === "aqiqah"
    ? "Aqiqah"
    : event?.event_type === "birthday"
    ? "Ulang Tahun"
    : "Undangan";

  return (
    <div
      className="min-h-full relative inv-bg"
      style={{ background: theme.bg, color: textColor, fontFamily: "Figtree, sans-serif" }}
      data-testid="invitation-renderer"
    >
      {/* Hero */}
      <section className="relative px-6 pt-10 pb-8 text-center overflow-hidden">
        <div className="text-xs uppercase tracking-[0.3em]" style={{ color: theme.accent }}>{label}</div>
        <h1
          className="mt-4 leading-[1.05]"
          style={{ fontFamily: `${theme.font_heading}, serif`, fontSize: preview ? "2.5rem" : "3.5rem", color: textColor }}
        >
          {heroTitle}
        </h1>
        <div className="w-16 h-px mx-auto my-5" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />
        {cfg.parents && <div className="text-sm italic" style={{ color: mutedColor }}>Putra dari {cfg.parents}</div>}
        {dateFormatted && (
          <div className="mt-3 text-sm" style={{ color: mutedColor }}>
            {dateFormatted}{cfg.event_time ? ` · ${cfg.event_time} WIB` : ""}
          </div>
        )}
      </section>

      {/* Guest greeting */}
      {guest?.name && (
        <section className="px-6 py-6 text-center border-y" style={{ borderColor: isDark ? "#3a2e26" : "#e2dfd9" }}>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: mutedColor }}>Kepada Yth.</div>
          <div className="mt-2 text-2xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor }}>
            {guest.name}
          </div>
        </section>
      )}

      {/* Story */}
      {cfg.story && (
        <section className="px-6 py-8 text-center">
          <p className="italic leading-relaxed text-sm" style={{ fontFamily: `${theme.font_heading}, serif`, color: mutedColor, fontSize: "1.05rem" }}>
            &ldquo;{cfg.story}&rdquo;
          </p>
        </section>
      )}

      {/* Gallery */}
      {cfg.gallery?.length > 0 && (
        <section className="px-6 pb-8">
          <div className="grid grid-cols-2 gap-2">
            {cfg.gallery.slice(0, 6).map((url, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Venue */}
      <section className="px-6 py-8 text-center" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em]" style={{ color: theme.accent }}>
          <MapPin className="w-3.5 h-3.5" /> Lokasi
        </div>
        {cfg.venue && (
          <div className="mt-3 text-xl" style={{ fontFamily: `${theme.font_heading}, serif`, color: textColor }}>{cfg.venue}</div>
        )}
        {cfg.venue_address && <p className="mt-2 text-sm" style={{ color: mutedColor }}>{cfg.venue_address}</p>}
        {cfg.event_date && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ border: `1px solid ${theme.accent}`, color: theme.accent }}>
            <Calendar className="w-3.5 h-3.5" /> {dateFormatted}
          </div>
        )}
      </section>

      {/* Music player floating */}
      {cfg.music_url && (
        <div className="fixed bottom-4 right-4 z-30" style={{ position: preview ? "sticky" : "fixed" }}>
          <details className="rounded-full bg-black/85 backdrop-blur px-3 py-2 text-white text-xs">
            <summary className="flex items-center gap-1.5 cursor-pointer list-none"><Music2 className="w-3.5 h-3.5" /> Musik</summary>
            <audio controls autoPlay src={cfg.music_url} className="mt-2 w-56" />
          </details>
        </div>
      )}

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-xs" style={{ color: mutedColor }}>
        Undangan Digital · {event?.event_type}
      </footer>
    </div>
  );
}
