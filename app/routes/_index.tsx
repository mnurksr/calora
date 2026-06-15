import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import prisma from "../db.server";
import { useEffect, useState, useRef } from "react";
import Vapi from "@vapi-ai/web";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app${url.search}`);
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }
  try {
    await prisma.waitlistEntry.create({ data: { email: email.toLowerCase().trim() } });
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002") return { success: true };
    return { error: "Something went wrong. Please try again later." };
  }
};

export default function LandingPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Vapi Call State
  const [callStatus, setCallStatus] = useState<"inactive" | "loading" | "active">("inactive");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callTime, setCallTime] = useState(0);
  const [testError, setTestError] = useState("");
  const vapiRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const publicKey = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_VAPI_PUBLIC_KEY : "";
    vapiRef.current = new Vapi(publicKey || "dummy-key");

    vapiRef.current.on('call-start', () => {
      setCallStatus("active");
      setCallTime(0);
      timerRef.current = setInterval(() => setCallTime(p => p + 1), 1000);
    });

    vapiRef.current.on('call-end', () => {
      setCallStatus("inactive");
      clearInterval(timerRef.current);
      setVolumeLevel(0);
    });

    vapiRef.current.on('volume-level', (vol: number) => {
      setVolumeLevel(vol);
    });

    vapiRef.current.on('error', (e: any) => {
      setCallStatus("inactive");
      clearInterval(timerRef.current);
      console.error(e);
      if (e?.message?.includes("navigator.mediaDevices")) {
         setTestError("Microphone access is required to test the agent.");
      } else {
         setTestError("Failed to connect. Make sure VITE_VAPI_PUBLIC_KEY and VITE_VAPI_ASSISTANT_ID are set.");
      }
    });

    return () => {
      vapiRef.current?.stop();
      clearInterval(timerRef.current);
    };
  }, []);

  const toggleCall = async () => {
    if (callStatus === "active" || callStatus === "loading") {
      vapiRef.current?.stop();
    } else {
      setCallStatus("loading");
      setTestError("");
      try {
        const assistantId = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_VAPI_ASSISTANT_ID : "";
        if (!assistantId) {
          throw new Error("Missing VITE_VAPI_ASSISTANT_ID in .env");
        }
        await vapiRef.current?.start(assistantId);
      } catch (err: any) {
        console.error(err);
        setCallStatus("inactive");
        setTestError(err.message || "Failed to connect.");
      }
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="page">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />

        {/* Nav */}
        <nav className="nav">
          <a href="/" className="logo">Calora</a>
          <a href="#waitlist" className="nav-btn">Join Waitlist →</a>
        </nav>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="badge"><span className="badge-dot" />Shopify App · Coming Soon</div>
          <h1 className="heading">Recover abandoned<br/>carts with <span className="gradient-text">AI voice calls</span></h1>
          <p className="sub">Calora automatically calls your customers with a human-like AI voice, offers a personalized discount, and recovers the sale — on autopilot.</p>
          
          <div className="waitlist" id="waitlist">
            {actionData?.success ? (
              <div className="success-msg">✓ You're on the list. We'll reach out soon.</div>
            ) : (
              <Form method="post">
                <div className="form-row">
                  <input type="email" name="email" placeholder="your@email.com" required className="email-input" id="waitlist-email" />
                  <button type="submit" disabled={isSubmitting} className="submit-btn" id="waitlist-btn">
                    {isSubmitting ? "Joining..." : "Get Early Access"}
                  </button>
                </div>
                {actionData?.error && <div className="error-msg">{actionData.error}</div>}
              </Form>
            )}
            <p className="hint">Free for early adopters · No credit card required</p>

            {/* Subtle Interactive Demo Trigger seamlessly embedded */}
            <div className="hero-demo-trigger">
              <button onClick={toggleCall} className={`demo-btn ${callStatus === 'active' || callStatus === 'loading' ? 'demo-btn-active' : ''}`}>
                {callStatus === "active" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.36 8.84 7.44 7 12 7s8.64 1.84 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                )}
                {callStatus === "inactive" ? "Test AI Voice in Browser" : callStatus === "loading" ? "Connecting to agent..." : `End Voice Call · ${fmt(callTime)}`}
              </button>
            </div>
            {testError && <div className="error-msg" style={{textAlign:"center", marginTop:"0.5rem"}}>{testError}</div>}
          </div>
        </section>

        {/* Live Call Simulation (Native Phone UI) */}
        <section className="transcript-section">
          <p className="section-tag">Live Simulation</p>
          <h2 className="section-heading">Hear how Calora sounds</h2>
          
          <div className="demo-phone-wrapper">
            <div className="native-phone-frame">
               {/* Top Bar */}
               <div className="np-top">
                 <span>9:41</span>
                 <div className="np-icons">📶 🔋</div>
               </div>
               
               {/* Call Info */}
               <div className="np-call-info">
                 <div className="np-avatar">🤖</div>
                 <h3 className="np-name">Calora AI Agent</h3>
                 <p className="np-status">01:24</p>
               </div>

               {/* Live Captions (Transcript) */}
               <div className="np-captions">
                 <div className="np-caption-line ai-line" style={{animationDelay: "0.5s"}}>
                    Hi Sarah! I noticed you left some items in your cart. Can I offer you 15% off?
                 </div>
                 <div className="np-caption-line user-line" style={{animationDelay: "3s"}}>
                    Oh really? That sounds great!
                 </div>
                 <div className="np-caption-line ai-line" style={{animationDelay: "5s"}}>
                    Perfect! I just texted you the code SAVE15. It's valid for 24 hours.
                 </div>
               </div>

               {/* Native Phone Controls */}
               <div className="np-controls">
                 <div className="np-btn-row">
                   <div className="np-btn"><div className="np-icon">🎙️</div><span>Mute</span></div>
                   <div className="np-btn"><div className="np-icon">🔢</div><span>Keypad</span></div>
                   <div className="np-btn"><div className="np-icon">🔊</div><span>Audio</span></div>
                 </div>
                 <div className="np-end-btn-wrapper">
                   <div className="np-end-btn">
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.36 8.84 7.44 7 12 7s8.64 1.84 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="stats">
          {[
            { val: "70%", label: "of carts are abandoned" },
            { val: "3x", label: "higher recovery than email" },
            { val: "<2min", label: "setup time" },
          ].map((s, i) => (
             <div key={i} className="stat">
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="how">
          <p className="section-tag">How it works</p>
          <h2 className="section-heading">Three steps. Zero effort.</h2>
          <div className="steps">
            {[
              { n: "01", icon: "📦", title: "Cart Abandoned", desc: "Shopify detects an abandoned checkout and sends it to Calora in real-time." },
              { n: "02", icon: "📞", title: "AI Calls Customer", desc: "After a smart delay, Calora's AI agent places a natural-sounding phone call." },
              { n: "03", icon: "💰", title: "Sale Recovered", desc: "The customer gets a discount, completes checkout, and you recover lost revenue." },
            ].map((s, i) => (
              <div key={i} className="step">
                <div className="step-n">{s.n}</div>
                <div className="step-icon">{s.icon}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="cta">
          <div className="cta-card">
            <h2 className="cta-title">Stop losing revenue to abandoned carts.</h2>
            <p className="cta-desc">Join the waitlist and be among the first Shopify stores to use AI voice recovery.</p>
            <a href="#waitlist" className="submit-btn" style={{ display: "inline-block", padding: "0.85rem 2.25rem", textDecoration: "none" }}>Join the Waitlist →</a>
          </div>
        </section>

        <footer className="footer">© {new Date().getFullYear()} Calora. All rights reserved.</footer>
      </div>
    </>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:#0c0e14;color:#e4e4e7;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::selection{background:rgba(99,102,241,0.4);color:#fff}

/* BG */
.bg-orb{position:fixed;border-radius:50%;filter:blur(100px);pointer-events:none;z-index:0}
.bg-orb-1{top:-15%;left:20%;width:600px;height:600px;background:radial-gradient(circle,rgba(99,102,241,0.12),transparent 70%)}
.bg-orb-2{bottom:-10%;right:15%;width:500px;height:500px;background:radial-gradient(circle,rgba(168,85,247,0.08),transparent 70%)}

.page{position:relative;min-height:100vh}

/* Nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;justify-content:space-between;align-items:center;padding:1.15rem 3rem;background:rgba(12,14,20,0.7);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.04)}
.logo{font-size:1.4rem;font-weight:800;color:#fff;text-decoration:none;letter-spacing:-0.5px}
.nav-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:.55rem 1.25rem;border-radius:980px;font-size:.85rem;font-weight:600;transition:all .2s;border:none}
.nav-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,0.35)}

/* Hero Section (Centered) */
.hero-section{position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;text-align:center;padding:7rem 2rem 4rem;min-height:auto;justify-content:center}
.badge{display:inline-flex;align-items:center;gap:.5rem;padding:.3rem 1rem;border-radius:980px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);color:#a5b4fc;font-size:.8rem;font-weight:600;margin-bottom:2rem}
.badge-dot{width:6px;height:6px;border-radius:50%;background:#818cf8;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.heading{font-size:clamp(2.5rem,6.5vw,5rem);font-weight:900;letter-spacing:-2.5px;line-height:1.08;max-width:850px;margin-bottom:1.5rem;color:#f4f4f5}
.gradient-text{background:linear-gradient(135deg,#818cf8,#a78bfa,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{font-size:1.15rem;color:#71717a;max-width:540px;line-height:1.7;margin-bottom:2.5rem}

/* Waitlist */
.waitlist{width:100%;max-width:480px;margin:0 auto}
.form-row{display:flex;gap:.5rem}
.email-input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:980px;padding:.85rem 1.5rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none;transition:all .25s}
.email-input::placeholder{color:#52525b}
.email-input:focus{border-color:rgba(99,102,241,0.5);box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
.submit-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:980px;padding:.85rem 1.75rem;font-size:.95rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s;white-space:nowrap}
.submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(99,102,241,0.3)}
.submit-btn:active{transform:scale(.97)}
.submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.success-msg{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.15);color:#4ade80;padding:1.1rem 2rem;border-radius:980px;font-weight:600;font-size:.95rem;text-align:center}
.error-msg{color:#f87171;font-size:.8rem;margin-top:.5rem;padding-left:1.5rem}
.hint{margin-top:.75rem;color:#3f3f46;font-size:.8rem;text-align:center;margin-bottom:1.5rem}

/* Simple Interactive Button (Embedded) */
.hero-demo-trigger{display:flex;justify-content:center;margin-top:1rem}
.demo-btn{background:transparent;border:1px solid rgba(255,255,255,0.15);color:#a1a1aa;padding:0.75rem 1.75rem;border-radius:980px;font-size:0.9rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;cursor:pointer;transition:all 0.2s}
.demo-btn:hover{background:rgba(255,255,255,0.05);color:#fff;border-color:rgba(255,255,255,0.3)}
.demo-btn-active{background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#ef4444}
.demo-btn-active:hover{background:rgba(239,68,68,0.15);color:#f87171}

/* Transcript Section (Native Phone UI) */
.transcript-section{position:relative;z-index:10;padding:5rem 2rem;max-width:1000px;margin:0 auto}
.demo-phone-wrapper{display:flex;justify-content:center;margin-top:3rem}
.native-phone-frame{width:100%;max-width:360px;height:720px;margin:0 auto;background:#1a1c23;border:8px solid #000;border-radius:3rem;overflow:hidden;position:relative;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.np-top{display:flex;justify-content:space-between;padding:1rem 1.5rem;font-size:0.85rem;font-weight:600;color:#fff}
.np-icons{letter-spacing:4px}
.np-call-info{display:flex;flex-direction:column;align-items:center;margin-top:2rem}
.np-avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin-bottom:1rem;box-shadow:0 0 30px rgba(99,102,241,0.4);animation:pulseAvatar 2s infinite}
@keyframes pulseAvatar{0%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)}70%{box-shadow:0 0 0 20px rgba(99,102,241,0)}100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}}
.np-name{font-size:1.5rem;font-weight:400;color:#fff;margin-bottom:0.25rem}
.np-status{font-size:1rem;color:#a1a1aa}
.np-captions{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:2rem 1.5rem;gap:1rem;overflow:hidden}
.np-caption-line{padding:1rem 1.25rem;border-radius:1rem;font-size:0.95rem;line-height:1.4;opacity:0;transform:translateY(20px);animation:slideUpFade 0.6s ease forwards}
@keyframes slideUpFade{to{opacity:1;transform:translateY(0)}}
.ai-line{background:rgba(99,102,241,0.15);color:#e0e7ff;backdrop-filter:blur(10px);border:1px solid rgba(99,102,241,0.2)}
.user-line{background:rgba(255,255,255,0.1);color:#fff;backdrop-filter:blur(10px);align-self:flex-end;text-align:right}
.np-controls{padding:2rem 1.5rem 2.5rem;background:linear-gradient(to top, rgba(0,0,0,0.8), transparent)}
.np-btn-row{display:flex;justify-content:space-between;margin-bottom:2rem;padding:0 1rem}
.np-btn{display:flex;flex-direction:column;align-items:center;gap:0.5rem;cursor:pointer}
.np-icon{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem;backdrop-filter:blur(10px)}
.np-btn span{font-size:0.75rem;color:#fff}
.np-end-btn-wrapper{display:flex;justify-content:center}
.np-end-btn{width:72px;height:72px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 25px rgba(239,68,68,0.4)}

/* Stats */
.stats{position:relative;z-index:10;display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;max-width:800px;margin:0 auto;padding:4rem 2rem;text-align:center}
.stat-val{font-size:clamp(2.5rem,5vw,3.5rem);font-weight:900;letter-spacing:-2px;background:linear-gradient(to bottom,#f4f4f5,#71717a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.stat-label{font-size:.85rem;color:#52525b;font-weight:500;margin-top:.25rem}

/* How */
.how{position:relative;z-index:10;padding:5rem 2rem;max-width:1100px;margin:0 auto}
.section-tag{text-align:center;color:#818cf8;font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:.75rem}
.section-heading{text-align:center;font-size:clamp(1.8rem,3.5vw,2.75rem);font-weight:800;letter-spacing:-1.5px;margin-bottom:3.5rem;color:#f4f4f5}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,0.04);border-radius:1.5rem;overflow:hidden;border:1px solid rgba(255,255,255,0.04)}
.step{padding:2.25rem 1.75rem;background:#0c0e14;transition:background .3s}
.step:hover{background:rgba(99,102,241,0.03)}
.step-n{font-size:.75rem;font-weight:700;color:#818cf8;letter-spacing:1px;margin-bottom:1rem}
.step-icon{font-size:2rem;margin-bottom:.75rem;display:block}
.step-title{font-size:1.1rem;font-weight:700;color:#f4f4f5;margin-bottom:.5rem;letter-spacing:-.3px}
.step-desc{font-size:.87rem;color:#52525b;line-height:1.6}

/* CTA */
.cta{position:relative;z-index:10;padding:5rem 2rem;text-align:center}
.cta-card{max-width:620px;margin:0 auto;padding:3.5rem 2.5rem;border-radius:2rem;background:linear-gradient(135deg,rgba(99,102,241,0.06),rgba(168,85,247,0.04));border:1px solid rgba(99,102,241,0.1)}
.cta-title{font-size:clamp(1.6rem,3vw,2.25rem);font-weight:800;letter-spacing:-1.5px;margin-bottom:.75rem;color:#f4f4f5}
.cta-desc{color:#71717a;font-size:1rem;margin-bottom:2rem;line-height:1.6}

.footer{position:relative;z-index:10;text-align:center;padding:2.5rem 2rem;border-top:1px solid rgba(255,255,255,0.04);color:#27272a;font-size:.8rem}

@media(max-width:768px){
  .nav{padding:1rem 1.5rem}
  .hero-section{padding:7rem 1.5rem 3rem}
  .form-row{flex-direction:column}
  .submit-btn{width:100%}
  .steps{grid-template-columns:1fr}
  .stats{grid-template-columns:1fr;gap:2rem}
  .cta-card{padding:2.5rem 1.5rem}
}
`;
