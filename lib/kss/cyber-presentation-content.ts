import type { SceneConfig } from "@/types/presentation"

export const cyberPresentationScenes: SceneConfig[] = [
  {
    id: "cover",
    eyebrow: "Cybersecurity Knowledge Sharing Session",
    title: "Cybersecurity Knowledge Sharing Session",
    body: "",
    theme: "vault",
    layout: "cover",
    coverMeta: {
      presenter: "Chibuikem Ilonze",
      department: "IT & Communications Department",
      date: "30/03/2026",
    },
  },
  {
    id: "what-is-cybersecurity",
    eyebrow: "Slide 2",
    title: "What Is Cybersecurity?",
    body: "Cybersecurity is the practice of protecting computers, systems, networks, applications, and data from unauthorized access, attacks, damage, and disruption. At ACOB Lighting Technology Limited, this means protecting our office devices, ERP access, communication channels, and business records so daily operations stay safe and reliable.",
    theme: "summit",
    layout: "insight",
  },
  {
    id: "types-of-cybersecurity",
    eyebrow: "Slide 3",
    title: "Types of Cybersecurity",
    body: "Core categories we use in practical office environments.",
    theme: "lumen",
    layout: "insight",
    cards: [
      { title: "Network Security", body: "Protects office and internet traffic from unauthorized access." },
      { title: "Endpoint Security", body: "Protects laptops, desktops, and mobile devices used for work." },
      { title: "Application Security", body: "Protects ERP and other business tools from misuse and vulnerabilities." },
      { title: "Cloud Security", body: "Protects company email, cloud storage, and hosted services." },
      { title: "Information Security", body: "Protects sensitive data from leakage, theft, and unauthorized changes." },
    ],
  },
  {
    id: "why-it-matters-at-acob",
    eyebrow: "Slide 4",
    title: "Why Cybersecurity Matters At ACOB",
    body: "Cybersecurity at ACOB is directly linked to productivity, trust, and business continuity.",
    theme: "aurora",
    layout: "spotlight",
    bullets: [
      { title: "Operational continuity", body: "Secure systems reduce downtime and keep teams productive." },
      { title: "Financial protection", body: "Stronger controls reduce fraud exposure and avoidable financial loss." },
      { title: "Data and brand trust", body: "Protecting staff and company data helps preserve confidence in ACOB." },
    ],
  },
  {
    id: "common-cyber-threats",
    eyebrow: "Slide 5",
    title: "Common Cyber Threats In The Office",
    body: "Most threats look normal at first, then create serious risk.",
    theme: "ember",
    layout: "insight",
    cards: [
      { title: "Phishing", body: "Fake emails or messages that try to steal login or financial details." },
      { title: "Malware", body: "Malicious files from links, attachments, unsafe software, or infected USB devices." },
      { title: "Weak passwords", body: "Simple or reused passwords make account compromise easier." },
      { title: "Insider mistakes", body: "Accidental risky actions can expose company systems or data." },
      {
        title: '"Your friend"',
        body: "A person you trust can still become a threat point, intentionally or unintentionally, if confidentiality is not respected.",
      },
    ],
  },
  {
    id: "everyday-best-practices",
    eyebrow: "Slide 6",
    title: "Everyday Staff Best Practices",
    body: "Consistent daily behavior is one of the strongest protections we have.",
    theme: "vault",
    layout: "spotlight",
    bullets: [
      { title: "Lock your system when not around", body: "Always lock your laptop or desktop before stepping away." },
      {
        title: "Password your system properly",
        body: "Use strong unique passwords and never share passwords or OTPs.",
      },
      {
        title: "Enable MFA for your logins",
        body: "MFA adds a second layer that helps protect accounts even if a password leaks.",
      },
      {
        title: "Trust no one with confidentials",
        body: "Do not share sensitive company details unless access is officially required.",
      },
      {
        title: "Ask your AI",
        body: "Use Claude, ChatGPT, or Gemini to quickly sanity-check suspicious messages before action.",
      },
    ],
  },
  {
    id: "myths-vs-truths",
    eyebrow: "Slide 7",
    title: "Myths vs Truths",
    body: "These common beliefs can create weak points if left unchallenged.",
    theme: "summit",
    layout: "insight",
    cards: [
      {
        title: "Myth: MFA means phishing cannot work",
        body: "Truth: Attackers can still capture session tokens or push repeated prompts until users approve by mistake.",
      },
      {
        title: "Myth: Internal-looking email domains are safe",
        body: "Truth: Domain spoofing and look-alike domains can mimic trusted senders almost perfectly.",
      },
      {
        title: "Myth: QR codes are safer than links",
        body: "Truth: Quishing hides malicious URLs in QR codes and bypasses normal visual link checks.",
      },
      {
        title: "Myth: Voice calls from known contacts are trustworthy",
        body: "Truth: AI voice cloning can imitate real colleagues and pressure urgent payment or access requests.",
      },
    ],
  },
  {
    id: "incident-reporting",
    eyebrow: "Slide 8",
    title: "Incident Reporting And Response Steps",
    body: "Speed and clarity are key when something suspicious happens.",
    theme: "aurora",
    layout: "insight",
    cards: [
      { title: "1. Pause immediately", body: "Stop clicking, replying, or sharing if you suspect a threat." },
      { title: "2. Report to IT", body: "Send details quickly to IT with message source, time, and screenshots." },
      {
        title: "3. Contain and recover",
        body: "Follow IT guidance: reset passwords, verify MFA, and scan affected devices.",
      },
      {
        title: "4. Ask your AI",
        body: "Use Claude, ChatGPT, and Gemini to review suspicious wording, links, and patterns before action.",
      },
    ],
  },
  {
    id: "controls-and-gaps",
    eyebrow: "Slide 9",
    title: "Department/IT Controls Already In Place + Gaps",
    body: "Current controls are useful, but specific gaps still need stronger consistency.",
    theme: "lumen",
    layout: "insight",
    cards: [
      {
        title: "Controls in place",
        body: "Core account and endpoint controls are in use across regular office workflows.",
      },
      {
        title: "Gap: Whitelist and blacklist",
        body: "Application, sender, and domain allow/block rules need tighter standardization and enforcement.",
      },
      {
        title: "Gap: Monitoring and control",
        body: "Stronger monitoring visibility and faster control actions are needed for early detection and response.",
      },
    ],
  },
  {
    id: "qa",
    eyebrow: "Slide 10",
    title: "Q / A",
    body: "",
    theme: "vault",
    layout: "titleOnly",
  },
  {
    id: "thank-you",
    eyebrow: "Slide 11",
    title: "Thank You",
    body: "",
    theme: "vault",
    layout: "titleOnly",
  },
]
