import { Footer } from "./_components/footer";
import { Navbar } from "./_components/navbar";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="px-4 pt-28 pb-24">{children}</main>
      <Footer />
    </div>
  );
}
