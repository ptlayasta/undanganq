import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api";
import { Check, ImageIcon } from "lucide-react";

/**
 * Curated stock background picker. Fetches from GET /api/stock-backgrounds
 * and calls onPick(url) when user selects an image.
 */
export default function StockPicker({ open, onOpenChange, onPick, currentUrl }) {
  const [categories, setCategories] = useState([]);
  const [all, setAll] = useState({});
  const [tab, setTab] = useState("");

  useEffect(() => {
    if (!open || categories.length > 0) return;
    (async () => {
      try {
        const { data } = await apiClient.get("/stock-backgrounds");
        setCategories(data.categories || []);
        setAll(data.all || {});
        if (data.categories?.length && !tab) setTab(data.categories[0].key);
      } catch { /* ignore */ }
    })();
  }, [open, categories.length, tab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="stock-picker">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#c05c46]" />
            Galeri Foto Stok
          </DialogTitle>
          <p className="text-sm text-neutral-500">Pilih latar sampul dari koleksi kurasi kami — gratis digunakan.</p>
        </DialogHeader>

        {categories.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">Memuat galeri...</div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="flex-wrap h-auto justify-start" data-testid="stock-tabs">
              {categories.map((c) => (
                <TabsTrigger key={c.key} value={c.key} data-testid={`stock-tab-${c.key}`}>{c.label}</TabsTrigger>
              ))}
            </TabsList>
            {categories.map((c) => (
              <TabsContent key={c.key} value={c.key} className="flex-1 overflow-y-auto mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
                  {(all[c.key] || []).map((url) => {
                    const active = url === currentUrl;
                    return (
                      <button
                        key={url}
                        data-testid={`stock-img-${c.key}-${(all[c.key] || []).indexOf(url)}`}
                        onClick={() => { onPick(url); onOpenChange(false); }}
                        className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 group transition-all ${active ? "border-[#c05c46] ring-2 ring-[#c05c46]/30" : "border-transparent hover:border-neutral-400"}`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        {active && (
                          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#c05c46] flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
