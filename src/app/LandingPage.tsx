import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  AlertTriangle, ArrowRight, BarChart3, Boxes, Calendar, CheckCircle2, ChevronRight, DollarSign,
  FileSpreadsheet, LockKeyhole, Mail, MapPin, Menu, Milk,
  Phone, RefreshCw, ShieldCheck, ShoppingCart, TrendingUp, Users, X,
} from "lucide-react";
import { C } from "@/styles/tokens/colors";
import LOGO_SRC from "../../assets/images/logo.jpg";
import BG_SRC from "../../assets/images/bg.jpg";

interface LandingPageProps { onLogin?: () => void }

const NAV_LINKS = [
  { label: "Home", id: "home" },
  { label: "Capabilities", id: "features" },
  { label: "How It Works", id: "about" },
  { label: "Contact", id: "contact" },
] as const;

function useLandingReveal(delay = 0, direction: "up" | "left" | "right" = "up") {
  const reducedMotion = useReducedMotion();
  return {
    initial: reducedMotion ? false : { opacity: 0, x: direction === "left" ? -36 : direction === "right" ? 36 : 0, y: direction === "up" ? 36 : 0 },
    whileInView: { opacity: 1, x: 0, y: 0 },
    viewport: { once: false, amount: 0.12 },
    transition: { duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
}

function NavBar({ onLogin }: { onLogin?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          // Sort by highest visibility ratio in viewport
          const mostVisible = visible.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          setActiveSection(mostVisible.target.id);
        }
      },
      { rootMargin: "-10% 0px -40% 0px", threshold: [0.1, 0.3, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navigate = (id: string) => {
    scrollToId(id);
    setMobileOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${scrolled ? "shadow-[0_8px_30px_rgba(15,23,42,0.07)]" : "shadow-none"}`}
      style={{ backgroundColor: `${C.white}F2`, borderColor: C.border }}
    >
      <div className="flex h-[72px] w-full items-center justify-between px-4 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-6">
        <button onClick={() => navigate("home")} className="flex min-w-0 items-center gap-3 text-left md:justify-self-start">
          <img src={LOGO_SRC} alt="Rosario Dairy logo" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain shadow-sm" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold" style={{ color: C.text }}>Rosario Dairy</span>
          </span>
        </button>

        <nav className="hidden items-center justify-self-center gap-8 whitespace-nowrap md:flex" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => {
            const active = activeSection === link.id;
            return (
              <button key={link.id} onClick={() => navigate(link.id)} className="relative py-2 text-sm font-medium transition-colors" style={{ color: active ? C.blue : C.muted }}>
                {link.label}
                <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-0.5 rounded-full transition-all duration-300" style={{ width: active ? "100%" : 0, backgroundColor: C.blue }} />
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:justify-self-end">
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onLogin} className="hidden rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm md:block" style={{ backgroundColor: C.action }}>
            Sign in
          </motion.button>
        <button className="rounded-lg p-2 md:hidden" style={{ color: C.text }} onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t md:hidden" style={{ borderColor: C.border, backgroundColor: C.white }}>
            <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => (
                <button key={link.id} onClick={() => navigate(link.id)} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium" style={{ color: activeSection === link.id ? C.blue : C.text, backgroundColor: activeSection === link.id ? `${C.blue}0D` : "transparent" }}>
                  {link.label}
                </button>
              ))}
              <button onClick={onLogin} className="mt-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: C.action }}>Sign in</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function DashboardShowcase({ scale }: { scale?: MotionValue<number> }) {
  const reducedMotion = useReducedMotion();
  const reveal = useLandingReveal(0.12);
  // Presentation-only examples; never mount authenticated dashboard components or queries here.
  const forecast = "36,104 75,88 114,94 153,61 192,68 231,40 270,22";
  return (
    <motion.div {...reveal} style={{ scale: reducedMotion ? 1 : scale }} className="relative min-w-0 w-full max-w-lg origin-center justify-self-center lg:origin-right lg:justify-self-end">
      <motion.div aria-hidden="true" initial={{ opacity: 0.6 }} whileInView={reducedMotion ? { opacity: 0.6 } : { opacity: [0.5, 0.7, 0.5] }} viewport={{ once: false }} transition={reducedMotion ? { duration: 0 } : { duration: 6, repeat: Infinity }} className="pointer-events-none absolute -inset-5 -z-10 rounded-[32px] blur-2xl" style={{ background: `linear-gradient(135deg, ${C.blue}20, ${C.green}12)` }} />
      <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} transition={{ duration: 0.2 }} className="overflow-hidden rounded-3xl border p-4 sm:p-5" style={{ backgroundColor: C.white, borderColor: C.border, boxShadow: "0 28px 70px -32px rgba(23,55,94,0.42)" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="mt-1 text-base font-bold sm:text-lg" style={{ color: C.text }}>Operations Dashboard</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color: C.blue, backgroundColor: `${C.blue}12` }}>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {[
            { label: "Today's Sales", value: "₱36.4K", change: "+12.1%", icon: DollarSign, color: C.green },
            { label: "Low Stock Alerts", value: "8", change: "Action Required", icon: AlertTriangle, color: C.red },
            { label: "Expiring Soon", value: "5", change: "Configured window", icon: Calendar, color: C.orange },
          ].map((item) => {
            const Icon = item.icon;
            return <motion.div key={item.label} whileHover={reducedMotion ? undefined : { y: -3, boxShadow: "0 12px 24px -16px rgba(15,23,42,0.25)" }} transition={{ duration: 0.3 }} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl sm:h-8 sm:w-8" style={{ backgroundColor: `${item.color}18`, color: item.color }}><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" /></div>
              <p className="text-base font-bold tracking-tight sm:text-xl" style={{ color: C.text }}>{item.value}</p>
              <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-800 sm:text-xs">{item.label}</p>
              <p className="mt-1.5 text-[10px] font-medium leading-snug sm:text-[11px]" style={{ color: item.color }}>{item.change}</p>
            </motion.div>;
          })}
        </div>

        <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-xs font-semibold text-slate-800 sm:text-sm">SARIMA Sales Forecast</p><p className="mt-1 text-[10px] sm:text-[11px]" style={{ color: C.muted }}>Seven-day sample · illustrative revenue only</p></div>
            <span className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold" style={{ color: C.blue, backgroundColor: `${C.blue}10` }}>+12.0%</span>
          </div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}><span className="h-0.5 w-3" style={{ backgroundColor: C.blue }} />Sample prediction</div>
          <svg viewBox="0 0 284 138" className="h-24 w-full sm:h-28" role="img" aria-label="Illustrative SARIMA revenue forecast using static demo values, not actual sales or live predictions">
            <defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity="0.2" /><stop offset="100%" stopColor={C.blue} stopOpacity="0" /></linearGradient></defs>
            {[{ y: 20, label: "₱40K" }, { y: 50, label: "₱30K" }, { y: 80, label: "₱20K" }, { y: 110, label: "₱10K" }].map(tick => <g key={tick.y}><line x1="36" x2="270" y1={tick.y} y2={tick.y} stroke={C.border} strokeDasharray="3 3" /><text x="2" y={tick.y + 3} fontSize="9" fill={C.muted}>{tick.label}</text></g>)}
            <polygon points={`36,110 ${forecast} 270,110`} fill="url(#forecastFill)" />
            <motion.polyline points={forecast} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={reducedMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : 0.1 }} />
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <text key={day} x={36 + index * 39} y="130" textAnchor="middle" fontSize="9" fill={C.muted}>{day}</text>)}
          </svg>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed" style={{ color: C.muted }}>Demo figures only. This preview does not request live dashboard data.</p>
      </motion.div>
    </motion.div>
  );
}

function HeroSection({ onLogin }: { onLogin?: () => void }) {
  const reducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  // Motion values update transforms without changing layout or rerendering on scroll.
  const heroScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.9]);
  const entrance = {
    hidden: { opacity: 0, y: 36 },
    visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.7 } },
  };
  return (
    <section ref={heroRef} id="home" className="relative scroll-mt-[72px] overflow-hidden pt-8 pb-16 sm:pt-10 sm:pb-24 lg:pt-12 lg:pb-28" style={{ backgroundColor: C.sidebar, backgroundImage: `radial-gradient(ellipse at center, rgba(15,42,74,0.45) 0%, rgba(15,42,74,0.55) 45%, rgba(15,42,74,0.88) 100%), url(${BG_SRC})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 15% 10%, ${C.blue}12, transparent 34%), radial-gradient(circle at 90% 80%, ${C.green}0D, transparent 30%)` }} />
      <div className="relative grid w-full min-w-0 items-center gap-12 px-4 sm:px-8 md:gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-12 xl:gap-20">
        <motion.div className="min-w-0 origin-center lg:origin-left" style={{ scale: reducedMotion ? 1 : heroScale }} initial={reducedMotion ? false : "hidden"} whileInView="visible" viewport={{ once: false, amount: 0.12 }} variants={{ visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.12 } } }}>
          <motion.h1 variants={entrance} className="max-w-2xl text-[2.625rem] font-bold leading-[1.08] sm:text-[3.25rem] lg:text-[3.75rem] xl:text-[4rem]" style={{ color: "#FFFFFF" }}>Control dairy operations with clarity and confidence.</motion.h1>
          <motion.p variants={entrance} className="mt-6 max-w-xl text-lg leading-relaxed sm:text-xl" style={{ color: "rgba(255,255,255,0.7)" }}>Unify batch-level inventory, point-of-sale activity, management reporting, and demand forecasting in one dependable operating system.</motion.p>
          <motion.div variants={entrance} className="mt-8 flex flex-wrap gap-3">
            <motion.button whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} transition={{ duration: 0.18 }} onClick={onLogin} className="inline-flex max-w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold text-white shadow-lg" style={{ backgroundColor: C.action, boxShadow: `0 14px 28px -14px ${C.action}` }}>Access the platform <ArrowRight size={18} className="shrink-0" /></motion.button>
            <motion.button whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} transition={{ duration: 0.18 }} onClick={() => scrollToId("features")} className="max-w-full rounded-xl border px-6 py-4 text-base font-semibold transition-colors hover:bg-white/10" style={{ color: "#FFFFFF", borderColor: "rgba(255,255,255,0.3)" }}>Explore capabilities</motion.button>
          </motion.div>
        </motion.div>
        <DashboardShowcase scale={heroScale} />
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, subtitle, centered = false }: { eyebrow: string; title: string; subtitle: string; centered?: boolean }) {
  const reveal = useLandingReveal();
  return (
    <motion.div {...reveal} className={`max-w-2xl ${centered ? "mx-auto text-center" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: C.blue }}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl" style={{ color: C.text }}>{title}</h2>
      <p className="mt-4 text-base leading-7" style={{ color: C.muted }}>{subtitle}</p>
    </motion.div>
  );
}

function FeaturesSection() {
  const reducedMotion = useReducedMotion();
  const reveal = useLandingReveal();
  const features = [
    { icon: Boxes, title: "Batch inventory", desc: "Track quantities, expiry dates, and FEFO priority at batch level." },
    { icon: ShoppingCart, title: "Integrated POS", desc: "Record transactions while keeping available stock synchronized." },
    { icon: TrendingUp, title: "Demand forecasting", desc: "Use SARIMA projections to support purchasing and production plans." },
    { icon: BarChart3, title: "Management analytics", desc: "Monitor revenue, stock risk, and product performance from one view." },
    { icon: Users, title: "Customer operations", desc: "Maintain customer profiles, order history, and repeat-service context." },
    { icon: FileSpreadsheet, title: "Structured reporting", desc: "Prepare operational summaries for review, export, and audit." },
  ];
  return (
    <section id="features" className="scroll-mt-[72px] overflow-x-clip py-24 sm:py-28" style={{ backgroundColor: C.white }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow="Core capabilities" title="One source of truth for daily operations" subtitle="Each module solves a distinct operational need while sharing the same inventory and transaction data." centered />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article key={feature.title} {...reveal} initial={reducedMotion ? false : { opacity: 0, x: index % 2 === 0 ? -36 : 36, y: 0 }} transition={{ ...reveal.transition, delay: reducedMotion ? 0 : index % 3 * 0.12 }} whileHover={reducedMotion ? undefined : { y: -3, boxShadow: "0 18px 38px -26px rgba(15,23,42,0.32)", transition: { duration: 0.4, delay: 0 } }} className="group rounded-2xl border p-6 sm:p-7" style={{ borderColor: C.border, backgroundColor: C.white, boxShadow: "0 12px 34px -26px rgba(15,23,42,0.35)" }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" style={{ color: C.blue, backgroundColor: `${C.blue}0D` }}><Icon size={22} /></div>
                <h3 className="mt-5 text-base font-bold" style={{ color: C.text }}>{feature.title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>{feature.desc}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ onLogin }: { onLogin?: () => void }) {
  const reducedMotion = useReducedMotion();
  const reveal = useLandingReveal(0, "left");
  const steps = [
    { number: "01", icon: Milk, title: "Receive and classify", desc: "Register products and batches with quantity and expiry context." },
    { number: "02", icon: RefreshCw, title: "Operate in real time", desc: "Sales and orders flow through role-appropriate daily workflows." },
    { number: "03", icon: BarChart3, title: "Review performance", desc: "Operational data becomes clear management indicators and reports." },
    { number: "04", icon: TrendingUp, title: "Plan forward", desc: "Forecasts convert historical sales into evidence-based decisions." },
  ];
  return (
    <section id="about" className="scroll-mt-[72px] overflow-x-clip py-24 sm:py-28" style={{ backgroundColor: C.bg }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <SectionHeading eyebrow="Operating model" title="A controlled flow from receiving to planning" subtitle="Rosario Dairy replaces disconnected records with a traceable workflow designed around perishable inventory." />
          <div className="grid gap-3 sm:grid-cols-3">
            {[{ icon: LockKeyhole, label: "Role-aware access" }, { icon: ShieldCheck, label: "Traceable records" }, { icon: CheckCircle2, label: "Consistent process" }].map(({ icon: Icon, label }, index) => (
              <motion.div key={label} {...reveal} initial={reducedMotion ? false : { opacity: 0, x: index % 2 === 0 ? -36 : 36, y: 0 }} transition={{ ...reveal.transition, delay: reducedMotion ? 0 : index * 0.12 }} className="rounded-xl border p-4 text-center" style={{ backgroundColor: C.white, borderColor: C.border }}><Icon className="mx-auto" size={19} style={{ color: C.blue }} /><p className="mt-2 text-xs font-semibold" style={{ color: C.text }}>{label}</p></motion.div>
            ))}
          </div>
        </div>
        <div className="relative mt-14 grid gap-4 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div key={step.number} {...reveal} initial={reducedMotion ? false : { opacity: 0, x: index % 2 === 0 ? -36 : 36, y: 0 }} transition={{ ...reveal.transition, delay: reducedMotion ? 0 : index * 0.12 }} className="relative flex">
                <motion.article whileHover={reducedMotion ? undefined : { y: -3, boxShadow: "0 20px 42px -28px rgba(15,23,42,0.34)" }} transition={{ duration: reducedMotion ? 0 : 0.4 }} className="w-full rounded-2xl border p-6" style={{ backgroundColor: C.white, borderColor: C.border, boxShadow: "0 14px 38px -30px rgba(15,23,42,0.4)" }}>
                  <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.18em]" style={{ color: C.blue }}>{step.number}</span><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: C.navy, backgroundColor: `${C.blue}0D` }}><Icon size={19} /></div></div>
                  <h3 className="mt-6 text-base font-bold" style={{ color: C.text }}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: C.muted }}>{step.desc}</p>
                </motion.article>
                {index < steps.length - 1 && <ChevronRight className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 lg:block" size={17} style={{ color: C.blue }} />}
              </motion.div>
            );
          })}
        </div>
        <motion.div {...reveal} className="mt-16 overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-12" style={{ background: `linear-gradient(135deg, ${C.navy}, #244D7C)` }}>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#93C5FD" }}>Rosario Dairy Management System</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-bold text-white sm:text-3xl">Move from manual coordination to informed operational control.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6" style={{ color: "#CBD5E1" }}>Access inventory, POS, analytics, and forecasting through one secure workspace.</p>
          <motion.button whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={onLogin} className="mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white" style={{ backgroundColor: C.action }}>Sign in to continue <ArrowRight size={16} /></motion.button>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  const reducedMotion = useReducedMotion();
  const reveal = useLandingReveal();
  const brandReveal = useLandingReveal(0, "left");
  const contactReveal = useLandingReveal(0.24, "right");
  return (
    <footer id="contact" className="scroll-mt-[72px] overflow-x-clip border-t pt-14 pb-7" style={{ backgroundColor: "#0F1E33", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 border-b pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr]" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <motion.div {...brandReveal} className="max-w-sm"><div className="flex items-center gap-3">
          <div><p className="text-sm font-bold text-white">Rosario Dairy</p><p className="text-xs" style={{ color: "#94A3B8" }}>Integrated Inventory &amp; POS System</p></div></div><p className="mt-4 text-sm leading-6" style={{ color: "#94A3B8" }}>A unified operations platform for perishable inventory, sales control, and forward planning.</p></motion.div>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: reducedMotion ? 0 : 0.12 }}><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#64748B" }}>Navigate</p><div className="mt-4 flex flex-col gap-3">{NAV_LINKS.map((link) => <button key={link.id} onClick={() => scrollToId(link.id)} className="text-left text-sm transition-colors hover:text-white" style={{ color: "#CBD5E1" }}>{link.label}</button>)}</div></motion.div>
          <motion.div {...contactReveal}><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#64748B" }}>Contact</p><div className="mt-4 flex flex-col gap-3 text-sm" style={{ color: "#CBD5E1" }}><a className="flex items-center gap-2 hover:text-white" href="mailto:rocerojaymark31@gmail.com"><Mail size={15} />rocerojaymark31@gmail.com</a><a className="flex items-center gap-2 hover:text-white" href="tel:+639125096057"><Phone size={15} />0912 509 6057</a><p className="flex items-center gap-2"><MapPin size={15} />Rosario, Batangas, Philippines</p></div></motion.div>
        </div>
        <motion.p {...reveal} className="pt-6 text-center text-xs" style={{ color: "#64748B" }}>© {new Date().getFullYear()} Rosario Dairy Management System · FEFO and SARIMA Analytics</motion.p>
      </div>
    </footer>
  );
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen w-full" style={{ backgroundColor: C.bg }}>
      <NavBar onLogin={onLogin} />
      <main>
        <HeroSection onLogin={onLogin} />
        <FeaturesSection />
        <WorkflowSection onLogin={onLogin} />
      </main>
      <Footer />
    </div>
    </MotionConfig>
  );
}
