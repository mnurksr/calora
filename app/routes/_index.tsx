import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import prisma from "../db.server";

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
    await prisma.waitlistEntry.create({
      data: { email: email.toLowerCase().trim() },
    });
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { success: true }; // Ignore duplicates
    }
    return { error: "Something went wrong. Please try again later." };
  }
};

export default function LandingPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#050505",
      color: "#ffffff",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background Glow Effects */}
      <div style={{
        position: "absolute",
        top: "-20%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "80vw",
        height: "50vh",
        background: "radial-gradient(ellipse at center, rgba(88, 101, 242, 0.15) 0%, rgba(0,0,0,0) 70%)",
        filter: "blur(60px)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      {/* Navigation */}
      <nav style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1.5rem 4rem",
        borderBottom: "1px solid rgba(255,255,255,0.05)"
      }}>
        <div style={{ fontSize: "1.5rem", fontWeight: "800", letterSpacing: "-0.5px", background: "linear-gradient(to right, #fff, #a0a0a0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          MercSync
        </div>
        <div>
          <a href="#waitlist" style={{
            background: "rgba(255,255,255,0.1)",
            color: "white",
            textDecoration: "none",
            padding: "0.5rem 1rem",
            borderRadius: "9999px",
            fontSize: "0.875rem",
            fontWeight: "500",
            transition: "background 0.2s"
          }}>
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6rem 2rem 4rem",
        textAlign: "center"
      }}>
        <div style={{
          display: "inline-block",
          padding: "0.25rem 1rem",
          borderRadius: "9999px",
          background: "rgba(88, 101, 242, 0.1)",
          border: "1px solid rgba(88, 101, 242, 0.3)",
          color: "#9aa5ff",
          fontSize: "0.875rem",
          fontWeight: "600",
          marginBottom: "1.5rem"
        }}>
          ✨ Coming Soon to Shopify
        </div>
        
        <h1 style={{
          fontSize: "4.5rem",
          fontWeight: "800",
          letterSpacing: "-2px",
          lineHeight: "1.1",
          maxWidth: "800px",
          margin: "0 0 1.5rem 0",
          background: "linear-gradient(to bottom right, #ffffff, #888888)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          AI Voice Agents for Ecommerce
        </h1>
        
        <p style={{
          fontSize: "1.25rem",
          color: "#a0a0a0",
          maxWidth: "600px",
          margin: "0 0 3rem 0",
          lineHeight: "1.6"
        }}>
          Automatically recover abandoned carts and scale your customer service with human-like AI phone calls. Zero setup required.
        </p>

        {/* Waitlist Form */}
        <div id="waitlist" style={{ width: "100%", maxWidth: "440px", position: "relative" }}>
          {actionData?.success ? (
            <div style={{
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              color: "#4ade80",
              padding: "1.5rem",
              borderRadius: "1rem",
              fontWeight: "500",
              boxShadow: "0 0 30px rgba(34, 197, 94, 0.1)"
            }}>
              🎉 You're on the list! We'll be in touch soon.
            </div>
          ) : (
            <Form method="post" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your work email"
                  required
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.75rem",
                    padding: "1rem 1.25rem",
                    color: "white",
                    fontSize: "1rem",
                    outline: "none",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(88, 101, 242, 0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: "linear-gradient(135deg, #5865F2, #4752C4)",
                    color: "white",
                    border: "none",
                    borderRadius: "0.75rem",
                    padding: "0 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: "transform 0.1s",
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
                  onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  {isSubmitting ? "Joining..." : "Join Waitlist"}
                </button>
              </div>
              {actionData?.error && (
                <div style={{ color: "#ef4444", fontSize: "0.875rem", textAlign: "left", paddingLeft: "0.5rem" }}>
                  {actionData.error}
                </div>
              )}
            </Form>
          )}
        </div>
      </main>

      {/* Features Section */}
      <section style={{
        position: "relative",
        zIndex: 10,
        padding: "4rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "2rem"
      }}>
        {[
          {
            icon: "📞",
            title: "Human-like Conversations",
            desc: "Our AI sounds completely natural, pausing, interrupting, and empathizing just like a real support agent."
          },
          {
            icon: "⚡",
            title: "Automated Recovery",
            desc: "Calls are placed exactly 60 minutes after a cart is abandoned, offering personalized discounts to save the sale."
          },
          {
            icon: "📊",
            title: "Deep Analytics",
            desc: "View full call transcripts, listen to recordings, and track exactly how much revenue the AI is recovering."
          }
        ].map((feature, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "1.5rem",
            padding: "2rem",
            transition: "transform 0.3s, background 0.3s",
            cursor: "default"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-5px)";
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{feature.icon}</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.75rem", color: "#fff" }}>{feature.title}</h3>
            <p style={{ color: "#a0a0a0", lineHeight: "1.5", fontSize: "0.95rem" }}>{feature.desc}</p>
          </div>
        ))}
      </section>
      
      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "3rem 2rem",
        color: "#666",
        fontSize: "0.875rem",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        marginTop: "4rem"
      }}>
        © {new Date().getFullYear()} MercSync. All rights reserved.
      </footer>
    </div>
  );
}
