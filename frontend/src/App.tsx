import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { LogoAutoJurnal, Putar } from "./components/ui";
import { useAuth } from "./lib/auth";
import Akun from "./pages/Akun";
import CekNaskah from "./pages/CekNaskah";
import { DaftarJurnal, EditJurnal, JurnalBaru } from "./pages/Jurnal";
import Masuk from "./pages/Masuk";
import Pengaturan from "./pages/Pengaturan";
import Pengguna from "./pages/Pengguna";
import { DetailCek, Riwayat } from "./pages/Riwayat";

function LayarMemuat() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <LogoAutoJurnal ukuran={52} />
      <Putar besar />
    </div>
  );
}

/** Halaman yang butuh login (dan opsional peran admin). */
function Wajib({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { pengguna, memuat } = useAuth();
  const lokasi = useLocation();
  if (memuat) return <LayarMemuat />;
  if (!pengguna) return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname }} />;
  if (admin && pengguna.peran !== "admin") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { memuat } = useAuth();
  return (
    <Routes>
      <Route path="/masuk" element={memuat ? <LayarMemuat /> : <Masuk />} />
      <Route path="/" element={<Wajib><CekNaskah /></Wajib>} />
      <Route path="/riwayat" element={<Wajib><Riwayat /></Wajib>} />
      <Route path="/riwayat/:id" element={<Wajib><DetailCek /></Wajib>} />
      <Route path="/jurnal" element={<Wajib><DaftarJurnal /></Wajib>} />
      <Route path="/jurnal/baru" element={<Wajib admin><JurnalBaru /></Wajib>} />
      <Route path="/jurnal/:id" element={<Wajib><EditJurnal /></Wajib>} />
      <Route path="/akun" element={<Wajib><Akun /></Wajib>} />
      <Route path="/pengguna" element={<Wajib admin><Pengguna /></Wajib>} />
      <Route path="/pengaturan" element={<Wajib admin><Pengaturan /></Wajib>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
