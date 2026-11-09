import * as React from "react";
import { Body, Button, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "react-email";

export const FIRM = {
  name: "V ACT Management Services Sdn. Bhd.",
  address: "Suite 9B.05, Level 9B, Wisma E & C, No. 2, Lorong Dungun Kiri, Damansara Heights, 50490 Kuala Lumpur",
  phone: "+603-2011 8002",
  whatsapp: "+6013-279 5163",
  email: "v.actmgt@gmail.com",
  website: "https://www.v-act.com.my",
};

const NAVY = "#0f1f3d";
const BLUE = "#29a3e0";

const styles = {
  body: { backgroundColor: "#f7f9fb", fontFamily: "Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" as const, maxWidth: 560, margin: "0 auto", border: "1px solid #dde3ec" },
  header: { backgroundColor: NAVY, padding: "20px 28px" },
  headerText: { color: "#ffffff", fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: 0.2 },
  content: { padding: "28px 28px 8px" },
  heading: { color: NAVY, fontSize: 20, fontWeight: 700, margin: "0 0 16px" },
  text: { color: "#1f2a44", fontSize: 15, lineHeight: "24px", margin: "0 0 14px" },
  muted: { color: "#5b6b85", fontSize: 13, lineHeight: "20px", margin: "0 0 8px" },
  button: { backgroundColor: BLUE, color: "#ffffff", fontSize: 15, fontWeight: 600, borderRadius: 8, padding: "12px 22px", textDecoration: "none", display: "inline-block" },
  footer: { padding: "16px 28px 24px" },
  footerText: { color: "#5b6b85", fontSize: 12, lineHeight: "18px", margin: "0 0 4px" },
  hr: { borderColor: "#dde3ec", margin: "8px 0 16px" },
  box: { backgroundColor: "#f7f9fb", border: "1px solid #dde3ec", borderRadius: 8, padding: "14px 16px", margin: "0 0 16px" },
  boxLabel: { color: "#5b6b85", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.6, margin: "0 0 4px" },
  boxValue: { color: NAVY, fontSize: 15, fontWeight: 600, margin: 0 },
};

export function EmailLayout({
  preview,
  heading,
  appUrl,
  brandName,
  children,
  cta,
}: {
  preview: string;
  heading: string;
  appUrl: string;
  brandName: string;
  children: React.ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img src={`${appUrl}/logo.png`} alt="V ACT" width="120" style={{ display: "block", marginBottom: 10 }} />
            <Text style={styles.headerText}>{brandName}</Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.heading}>{heading}</Text>
            {children}
            {cta ? (
              <Section style={{ margin: "20px 0 20px" }}>
                <Button href={cta.href} style={styles.button}>
                  {cta.label}
                </Button>
                <Text style={styles.muted}>
                  If the button does not work, copy this link into your browser: <Link href={cta.href}>{cta.href}</Link>
                </Text>
              </Section>
            ) : null}
          </Section>
          <Section style={styles.footer}>
            <Hr style={styles.hr} />
            <Text style={styles.footerText}>{FIRM.name}</Text>
            <Text style={styles.footerText}>{FIRM.address}</Text>
            <Text style={styles.footerText}>
              Tel {FIRM.phone} · WhatsApp {FIRM.whatsapp} · {FIRM.email}
            </Text>
            <Text style={styles.footerText}>
              This message was sent by the {brandName}. Replies to this email are not monitored; contact your
              V ACT officer directly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function InfoBox({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <Section style={styles.box}>
      {rows.map((row) => (
        <Section key={row.label} style={{ marginBottom: 10 }}>
          <Text style={styles.boxLabel}>{row.label}</Text>
          <Text style={styles.boxValue}>{row.value}</Text>
        </Section>
      ))}
    </Section>
  );
}

/** Renders admin-written free text: blank-line separated paragraphs. */
export function FreeText({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.text}>
          {p.split("\n").map((line, j, arr) => (
            <React.Fragment key={j}>
              {line}
              {j < arr.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </Text>
      ))}
    </>
  );
}
