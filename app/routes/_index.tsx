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

  // Demo Phone State
  const [demoState, setDemoState] = useState<"idle" | "incoming" | "connecting" | "active">("idle");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callTime, setCallTime] = useState(0);
  const [testError, setTestError] = useState("");
  const [transcripts, setTranscripts] = useState<{id: number, role: string, text: string}[]>([]);
  
  const vapiRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptId = useRef(0);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    if (transcriptsEndRef.current) {
      transcriptsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts]);

  useEffect(() => {
    const publicKey = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_VAPI_PUBLIC_KEY : "";
    vapiRef.current = new Vapi(publicKey || "dummy-key");

    vapiRef.current.on('call-start', () => {
      setDemoState("active");
      setCallTime(0);
      timerRef.current = setInterval(() => setCallTime(p => p + 1), 1000);
    });

    vapiRef.current.on('call-end', () => {
      setDemoState("idle");
      clearInterval(timerRef.current);
      setVolumeLevel(0);
      setTranscripts([]);
    });

    vapiRef.current.on('volume-level', (vol: number) => {
      setVolumeLevel(vol);
    });

    vapiRef.current.on('message', (msg: any) => {
      // Vapi provides live transcripts
      if (msg.type === 'transcript' && msg.transcriptType === 'final') {
        transcriptId.current += 1;
        setTranscripts(prev => [...prev, { id: transcriptId.current, role: msg.role, text: msg.transcript }]);
      }
    });

    vapiRef.current.on('error', (e: any) => {
      setDemoState("idle");
      clearInterval(timerRef.current);
      console.error(e);
      if (e?.message?.includes("navigator.mediaDevices")) {
         setTestError("Microphone access is required to test the agent.");
      } else {
         setTestError("Failed to connect. Make sure API keys are set.");
      }
      setTimeout(() => setTestError(""), 5000);
    });

    return () => {
      vapiRef.current?.stop();
      clearInterval(timerRef.current);
    };
  }, []);

  const triggerIncomingCall = () => {
    setDemoState("incoming");
  };

  const acceptCall = async () => {
    setDemoState("connecting");
    setTestError("");
    setTranscripts([]);
    try {
      const assistantId = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_VAPI_ASSISTANT_ID : "";
      if (!assistantId) {
        throw new Error("Missing VITE_VAPI_ASSISTANT_ID in .env");
      }
      await vapiRef.current?.start(assistantId);
    } catch (err: any) {
      console.error(err);
      setDemoState("idle");
      setTestError(err.message || "Failed to connect.");
    }
  };

  const endCall = () => {
    vapiRef.current?.stop();
    setDemoState("idle");
    clearInterval(timerRef.current);
    setTranscripts([]);
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

        {/* Hero Section (2-Column) */}
        <section className="hero-section">
          <div className="hero-content">
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
                  {actionData?.error && <div className="error-msg" style={{paddingLeft:"1.5rem"}}>{actionData.error}</div>}
                </Form>
              )}
              <p className="hint">Free for early adopters · No credit card required</p>
            </div>
          </div>

          <div className="hero-interactive">
            {/* The Native Phone Demo UI */}
            <div className="native-phone-frame">
               {/* Top Status Bar */}
               <div className="np-top">
                 <span>9:41</span>
                 <div className="np-icons">📶 🔋</div>
               </div>

               {/* State 1: Idle Screen */}
               {demoState === "idle" && (
                 <div className="np-screen np-idle">
                   <div className="np-idle-content">
                     <div className="np-logo-circle">
                       <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#818cf8"/><stop offset="100%" stopColor="#c084fc"/></linearGradient></defs><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                     </div>
                     <h3 className="np-idle-title">Experience Calora</h3>
                     <p className="np-idle-sub">Receive a simulated AI call right now in your browser.</p>
                     
                     <div className="np-trigger-wrapper">
                       <div className="np-pulse-ring"></div>
                       <button className="np-trigger-btn" onClick={triggerIncomingCall}>
                         Receive Demo Call
                       </button>
                     </div>
                     {testError && <p className="np-error">{testError}</p>}
                   </div>
                 </div>
               )}

               {/* State 2: Incoming Call */}
               {demoState === "incoming" && (
                 <div className="np-screen np-incoming">
                   <h2 className="np-incoming-title">Incoming Call...</h2>
                   <div className="np-avatar np-avatar-ringing">🤖</div>
                   <h3 className="np-name">Calora AI Agent</h3>
                   <p className="np-number">Web Demo</p>

                   <div className="np-incoming-actions">
                     <div className="np-action-col">
                       <button className="np-action-btn decline-btn" onClick={() => setDemoState("idle")}>
                         <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.36 8.84 7.44 7 12 7s8.64 1.84 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                       </button>
                       <span>Decline</span>
                     </div>
                     <div className="np-action-col">
                       <button className="np-action-btn accept-btn" onClick={acceptCall}>
                         <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                       </button>
                       <span>Accept</span>
                     </div>
                   </div>
                 </div>
               )}

               {/* State 3: Active Call */}
               {(demoState === "connecting" || demoState === "active") && (
                 <div className="np-screen np-active">
                   <div className="np-call-info" style={{ marginTop: "2rem" }}>
                     <div className="np-avatar" style={{ width: "64px", height: "64px", fontSize: "2rem", animation: "pulseAvatar 2s infinite" }}>🤖</div>
                     <h3 className="np-name" style={{ fontSize: "1.25rem" }}>Calora AI Agent</h3>
                     <p className="np-status">{demoState === "connecting" ? "Connecting..." : fmt(callTime)}</p>
                   </div>

                   {/* Live Transcripts Area */}
                   <div className="np-captions">
                     {transcripts.map((t) => (
                       <div key={t.id} className={`np-caption-line ${t.role === 'assistant' ? 'ai-line' : 'user-line'}`}>
                         {t.text}
                       </div>
                     ))}
                     {demoState === "active" && transcripts.length === 0 && (
                       <div className="np-caption-hint">Say "Hello" to start the conversation...</div>
                     )}
                     <div ref={transcriptsEndRef} />
                   </div>

                   {/* Controls */}
                   <div className="np-controls" style={{ paddingBottom: "2rem" }}>
                     {demoState === "active" ? (
                        <div className="waveform" style={{ height: "50px", marginBottom: "1.5rem" }}>
                          {Array.from({length: 20}).map((_, i) => {
                            const isCenter = i > 6 && i < 14;
                            const volMultiplier = isCenter ? 1.5 : 0.5;
                            const dynamicHeight = 12 + (volumeLevel * 100 * volMultiplier * Math.random());
                            return (
                              <div key={i} className="wave-bar" style={{
                                animationDelay: `${i * 0.08}s`,
                                height: `${Math.min(dynamicHeight, 40)}px`,
                                transition: "height 0.1s ease-out"
                              }} />
                            );
                          })}
                        </div>
                     ) : (
                        <div style={{ height: "50px", marginBottom: "1.5rem" }}></div>
                     )}

                     <div className="np-end-btn-wrapper">
                       <button className="np-end-btn" onClick={endCall}>
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.36 8.84 7.44 7 12 7s8.64 1.84 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85a.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                       </button>
                     </div>
                   </div>
                 </div>
               )}
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

/* Hero Section (2-Column Grid) */
.hero-section{position:relative;z-index:10;display:grid;grid-template-columns:1.1fr 0.9fr;gap:4rem;align-items:center;max-width:1200px;margin:0 auto;padding:9rem 2rem 5rem;min-height:85vh}
.hero-content{display:flex;flex-direction:column;align-items:flex-start;text-align:left}
.badge{display:inline-flex;align-items:center;gap:.5rem;padding:.3rem 1rem;border-radius:980px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);color:#a5b4fc;font-size:.8rem;font-weight:600;margin-bottom:2rem}
.badge-dot{width:6px;height:6px;border-radius:50%;background:#818cf8;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.heading{font-size:clamp(2.5rem,4.5vw,4.5rem);font-weight:900;letter-spacing:-2px;line-height:1.08;margin-bottom:1.5rem;color:#f4f4f5}
.gradient-text{background:linear-gradient(135deg,#818cf8,#a78bfa,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{font-size:1.1rem;color:#71717a;max-width:480px;line-height:1.6;margin-bottom:2.5rem}

/* Waitlist */
.waitlist{width:100%;max-width:420px}
.form-row{display:flex;gap:.5rem}
.email-input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:980px;padding:.85rem 1.5rem;color:#fff;font-size:.95rem;font-family:inherit;outline:none;transition:all .25s}
.email-input::placeholder{color:#52525b}
.email-input:focus{border-color:rgba(99,102,241,0.5);box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
.submit-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:980px;padding:.85rem 1.75rem;font-size:.95rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s;white-space:nowrap}
.submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(99,102,241,0.3)}
.submit-btn:active{transform:scale(.97)}
.submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.success-msg{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.15);color:#4ade80;padding:1.1rem 2rem;border-radius:980px;font-weight:600;font-size:.95rem;text-align:center}
.error-msg{color:#f87171;font-size:.8rem;margin-top:.5rem}
.hint{margin-top:.75rem;color:#3f3f46;font-size:.8rem;text-align:left;padding-left:1rem}

/* The Native Phone Frame (Hero Interactive) */
.native-phone-frame{width:100%;max-width:360px;height:720px;margin:0 auto;background:#1a1c23;border:8px solid #0c0e14;border-radius:3rem;overflow:hidden;position:relative;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.np-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;padding:0.85rem 1.5rem;font-size:0.8rem;font-weight:600;color:#fff;z-index:20}
.np-icons{letter-spacing:4px}
.np-screen{position:absolute;inset:0;display:flex;flex-direction:column;transition:opacity 0.3s}

/* State 1: Idle */
.np-idle{background:linear-gradient(180deg,#14161e 0%,#0c0e14 100%);justify-content:center;align-items:center;text-align:center;padding:2rem}
.np-logo-circle{width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.03);display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem;box-shadow:inset 0 0 20px rgba(255,255,255,0.02)}
.np-idle-title{font-size:1.5rem;color:#fff;margin-bottom:0.5rem;font-weight:700}
.np-idle-sub{font-size:0.9rem;color:#a1a1aa;margin-bottom:3rem;line-height:1.5}
.np-trigger-wrapper{position:relative;display:inline-block}
.np-pulse-ring{position:absolute;inset:-4px;border-radius:980px;border:2px solid #8b5cf6;animation:buttonPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite}
@keyframes buttonPulse{0%{transform:scale(1);opacity:0.8}100%{transform:scale(1.15);opacity:0}}
.np-trigger-btn{position:relative;z-index:2;background:#fff;color:#000;border:none;padding:1rem 2rem;border-radius:980px;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 10px 25px rgba(255,255,255,0.2);transition:transform 0.2s}
.np-trigger-btn:hover{transform:scale(1.05)}
.np-error{color:#ef4444;font-size:0.8rem;margin-top:1rem;background:rgba(239,68,68,0.1);padding:0.5rem;border-radius:0.5rem}

/* State 2: Incoming */
.np-incoming{background:linear-gradient(180deg,#1e1b4b 0%,#000 100%);align-items:center;padding-top:4rem}
.np-incoming-title{font-size:1rem;color:#a5b4fc;font-weight:500;margin-bottom:2rem;letter-spacing:1px}
.np-avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin-bottom:1rem;box-shadow:0 0 30px rgba(99,102,241,0.4)}
.np-avatar-ringing{animation:ringShake 0.5s infinite}
@keyframes ringShake{0%{transform:rotate(0)}25%{transform:rotate(-10deg)}50%{transform:rotate(0)}75%{transform:rotate(10deg)}100%{transform:rotate(0)}}
.np-name{font-size:2rem;font-weight:300;color:#fff;margin-bottom:0.25rem}
.np-number{font-size:1rem;color:#a1a1aa}
.np-incoming-actions{position:absolute;bottom:4rem;left:0;right:0;display:flex;justify-content:space-around;padding:0 2rem}
.np-action-col{display:flex;flex-direction:column;align-items:center;gap:0.75rem}
.np-action-col span{color:#fff;font-size:0.85rem}
.np-action-btn{width:72px;height:72px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.2s}
.np-action-btn:hover{transform:scale(1.05)}
.decline-btn{background:#ef4444}
.accept-btn{background:#22c55e;animation:pulseAccept 1.5s infinite}
@keyframes pulseAccept{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}70%{box-shadow:0 0 0 20px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}

/* State 3: Active Call */
.np-active{background:linear-gradient(180deg,#1a1c23 0%,#000 100%);display:flex;flex-direction:column}
.np-call-info{display:flex;flex-direction:column;align-items:center;padding-top:4rem}
@keyframes pulseAvatar{0%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)}70%{box-shadow:0 0 0 20px rgba(99,102,241,0)}100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}}
.np-status{font-size:0.9rem;color:#a1a1aa;margin-top:0.25rem}

.np-captions{flex:1;display:flex;flex-direction:column;padding:1rem 1.5rem;gap:0.75rem;overflow-y:auto;scroll-behavior:smooth}
.np-captions::-webkit-scrollbar{display:none}
.np-caption-hint{text-align:center;color:#52525b;font-size:0.85rem;margin-top:auto;padding-bottom:2rem}
.np-caption-line{padding:0.75rem 1rem;border-radius:1rem;font-size:0.9rem;line-height:1.4;animation:slideUpFade 0.3s ease forwards}
@keyframes slideUpFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.ai-line{background:rgba(99,102,241,0.15);color:#e0e7ff;border:1px solid rgba(99,102,241,0.2);align-self:flex-start;border-bottom-left-radius:0.25rem;max-width:90%}
.user-line{background:rgba(255,255,255,0.1);color:#fff;align-self:flex-end;border-bottom-right-radius:0.25rem;max-width:90%}

.np-controls{background:linear-gradient(to top, rgba(0,0,0,1) 50%, transparent);padding:0 1.5rem}
.np-end-btn-wrapper{display:flex;justify-content:center}
.np-end-btn{width:72px;height:72px;border-radius:50%;background:#ef4444;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 25px rgba(239,68,68,0.4);transition:transform 0.2s}
.np-end-btn:hover{transform:scale(1.05)}

.waveform{display:flex;align-items:center;justify-content:center;gap:3px}
.wave-bar{width:3px;border-radius:3px;background:linear-gradient(to top,#6366f1,#a78bfa);animation:waveAnim 1.2s ease-in-out infinite alternate}
@keyframes waveAnim{0%{transform:scaleY(0.3);opacity:.4}100%{transform:scaleY(1);opacity:1}}

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
  .hero-section{grid-template-columns:1fr;padding:7rem 1.5rem 3rem;text-align:center}
  .hero-content{align-items:center;text-align:center}
  .hint{text-align:center;padding-left:0;margin-left:0}
  .form-row{flex-direction:column}
  .submit-btn{width:100%}
  .steps{grid-template-columns:1fr}
  .stats{grid-template-columns:1fr;gap:2rem}
  .cta-card{padding:2.5rem 1.5rem}
}
`;
