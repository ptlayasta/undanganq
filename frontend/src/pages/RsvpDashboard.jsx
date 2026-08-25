import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import Header from "@/components/app/Header";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = { attending: "#4a5d4e", not_attending: "#c05c46", pending: "#d4af37" };

export default function RsvpDashboard() {
  const { eventId } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { if (!loading && !user) navigate("/", { replace: true }); }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get(`/events/${eventId}/rsvp/summary`);
        setData(data);
      } catch (e) { /* ignore */ }
    })();
  }, [eventId]);

  if (!data) return <div className="min-h-screen"><Header /></div>;

  const s = data.summary;
  const pieData = [
    { name: "Hadir", value: s.attending, key: "attending" },
    { name: "Tidak Hadir", value: s.not_attending, key: "not_attending" },
    { name: "Pending", value: s.pending, key: "pending" },
  ];
  const totalGuests = s.attending + s.not_attending + s.pending;

  return (
    <div className="min-h-screen" data-testid="rsvp-page">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <span className="overline">RSVP Real-time</span>
        <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Ringkasan Kehadiran</h1>

        <div className="grid md:grid-cols-4 gap-4 mt-8">
          <StatCard label="Total Tamu" value={totalGuests} accent="#1a1a1a" testid="stat-total" />
          <StatCard label="Konfirmasi Hadir" value={s.attending} accent="#4a5d4e" testid="stat-attending" />
          <StatCard label="Tidak Hadir" value={s.not_attending} accent="#c05c46" testid="stat-not-attending" />
          <StatCard label="Estimasi Kepala" value={s.total_headcount} accent="#d4af37" testid="stat-headcount" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          <div className="rounded-2xl border border-[#e2dfd9] bg-white p-6">
            <div className="overline">Distribusi RSVP</div>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {pieData.map((d) => <Cell key={d.key} fill={COLORS[d.key]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e2dfd9] bg-white p-6">
            <div className="overline">Perbandingan</div>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={pieData}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {pieData.map((d) => <Cell key={d.key} fill={COLORS[d.key]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-[#e2dfd9] bg-white overflow-hidden">
          <div className="px-6 py-4 border-b overline">Detail Respons</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tamu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead>Respons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.guests.map((g) => (
                <TableRow key={g.guest_id} data-testid={`rsvp-row-${g.guest_id}`}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>
                    <Badge className={g.rsvp_status === "attending" ? "bg-[#4a5d4e]" : g.rsvp_status === "not_attending" ? "bg-[#c05c46]" : "bg-[#d4af37] text-black"}>
                      {g.rsvp_status === "attending" ? "Hadir" : g.rsvp_status === "not_attending" ? "Tidak" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>{g.guest_count}</TableCell>
                  <TableCell className="text-sm text-neutral-500">{g.notes || "-"}</TableCell>
                  <TableCell className="text-xs text-neutral-500">{g.responded_at ? new Date(g.responded_at).toLocaleString("id-ID") : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent, testid }) {
  return (
    <div className="rounded-2xl border border-[#e2dfd9] bg-white p-6" data-testid={testid}>
      <div className="overline">{label}</div>
      <div className="mt-3 font-heading text-4xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}
