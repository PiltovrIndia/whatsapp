"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CirclePause,
  CirclePlay,
  ContactRound,
  FileCheck2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import styles from "./studio.module.css";

const chapters = [
  { label: "Connect", kicker: "01 / SECURE SETUP" },
  { label: "Import", kicker: "02 / CLEAN DATA" },
  { label: "Create", kicker: "03 / APPROVED COPY" },
  { label: "Send", kicker: "04 / VISIBLE DELIVERY" },
];

const journeys = [
  {
    number: "01",
    title: "Connect the business",
    summary: "One guided Meta flow. No credential scavenger hunt.",
    detail: "Authorize the business, WhatsApp account and phone number in a single, reviewable setup.",
    tag: "ONBOARDING",
  },
  {
    number: "02",
    title: "Bring the right people",
    summary: "Import clean contact data with consent kept in view.",
    detail: "Map columns, catch duplicates and keep every audience tied to an explicit source.",
    tag: "CONTACTS",
  },
  {
    number: "03",
    title: "Shape the message",
    summary: "Build approved templates in the same place you send them.",
    detail: "Preview variables, language and calls to action before synchronizing with WhatsApp.",
    tag: "TEMPLATES",
  },
  {
    number: "04",
    title: "Send with confidence",
    summary: "See the checklist before launch and every status after.",
    detail: "Review the audience, number and template, then follow delivery without changing tools.",
    tag: "DELIVERY",
  },
];

function BrandMark({ inverse = false }) {
  return (
    <span className={`${styles.brandMark} ${inverse ? styles.brandMarkInverse : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function DemoContent({ active }) {
  if (active === 0) {
    return (
      <div className={styles.demoScene} key="connect">
        <div className={styles.sceneHeader}>
          <div><span className={styles.sceneEyebrow}>WhatsApp onboarding</span><h3>Connect your business</h3></div>
          <span className={styles.securePill}><ShieldCheck size={13} /> Secure</span>
        </div>
        <div className={styles.setupGrid}>
          <div className={styles.setupCard}>
            <div className={styles.metaGlyph}>∞</div>
            <strong>Meta Embedded Signup</strong>
            <p>Authorize the business and select a WhatsApp number.</p>
            <span className={styles.demoButton}>Continue with Meta <ArrowRight size={14} /></span>
          </div>
          <div className={styles.checklist}>
            {["Business authorized", "WABA selected", "Phone number connected"].map((item, index) => (
              <div key={item} className={index === 2 ? styles.currentCheck : ""}>
                <span>{index < 2 ? <Check size={13} /> : index + 1}</span>{item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (active === 1) {
    return (
      <div className={styles.demoScene} key="import">
        <div className={styles.sceneHeader}>
          <div><span className={styles.sceneEyebrow}>Contacts / Import</span><h3>Bring in your audience</h3></div>
          <span className={styles.countPill}>1,284 contacts</span>
        </div>
        <div className={styles.importDrop}>
          <Upload size={18} /><div><strong>customers-october.csv</strong><p>Columns mapped automatically</p></div><span>Ready</span>
        </div>
        <div className={styles.dataTable}>
          <div><span>Name</span><span>Phone</span><span>Consent</span></div>
          {[["Asha Rao", "+91 98••• 4312", "Verified"], ["Neel Shah", "+91 99••• 2084", "Verified"], ["Mira & Co.", "+91 97••• 1146", "Verified"]].map((row) => (
            <div key={row[0]}>{row.map((cell, i) => <span key={cell} className={i === 2 ? styles.verified : ""}>{cell}</span>)}</div>
          ))}
        </div>
      </div>
    );
  }

  if (active === 2) {
    return (
      <div className={styles.demoScene} key="create">
        <div className={styles.sceneHeader}>
          <div><span className={styles.sceneEyebrow}>Template builder</span><h3>Order ready update</h3></div>
          <span className={styles.approvedPill}><FileCheck2 size={13} /> Approved</span>
        </div>
        <div className={styles.templateGrid}>
          <div className={styles.formMock}>
            <label>Message body</label>
            <div>Hi <em>{"{{1}}"}</em>, your order <em>{"{{2}}"}</em> is ready for dispatch.</div>
            <label>Call to action</label>
            <div className={styles.fieldMock}>Track order <span>URL</span></div>
          </div>
          <div className={styles.phoneMock}>
            <span className={styles.phoneTop}>Engage · Business</span>
            <div className={styles.chatBubble}><strong>Order ready</strong><p>Hi Asha, your order #1042 is ready for dispatch.</p><span>Track order</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.demoScene} key="send">
      <div className={styles.sceneHeader}>
        <div><span className={styles.sceneEyebrow}>Campaign / Live</span><h3>Order updates</h3></div>
        <span className={styles.livePill}><i /> Sending now</span>
      </div>
      <div className={styles.deliveryGrid}>
        <div className={styles.deliveryHero}>
          <span>Delivered</span><strong>1,206</strong><div className={styles.progressTrack}><i /></div><p>94% of the audience reached</p>
        </div>
        <div className={styles.metrics}>
          <div><span>Sent</span><strong>1,284</strong></div><div><span>Read</span><strong>918</strong></div><div><span>Failed</span><strong>06</strong></div>
        </div>
        <div className={styles.activity}>
          {["Asha Rao", "Neel Shah", "Mira & Co."].map((name, index) => <div key={name}><span className={styles.avatar}>{name[0]}</span><strong>{name}</strong><span>{index === 2 ? "Sent" : "Delivered"}</span></div>)}
        </div>
      </div>
    </div>
  );
}

export default function StudioLanding() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [openJourney, setOpenJourney] = useState(0);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % chapters.length), 4200);
    return () => window.clearInterval(timer);
  }, [playing]);

  function selectChapter(index) {
    setActive(index);
    setPlaying(false);
  }

  return (
    <main className={styles.siteShell}>
      <div className={styles.sideRailLeft} aria-hidden="true" /><div className={styles.sideRailRight} aria-hidden="true" />

      <nav className={styles.navWrap}>
        <div className={styles.navBar}>
          <Link href="/studio" className={styles.brand}><BrandMark /> <span>ENGAGE</span></Link>
          <div className={styles.navLinks}><a href="#demo">Demo</a><a href="#workflow">Workflow</a><a href="#principles">Principles</a></div>
          <div className={styles.navActions}><Link href="/login">Sign in</Link><Link href="/signup" className={styles.outlineButton}>Create workspace <ArrowRight size={14} /></Link></div>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.cornerTopLeft} /><div className={styles.cornerTopRight} />
        <div className={styles.heroTitle}>
          <p className={styles.microLabel}><span /> WHATSAPP OPERATIONS / 2026</p>
          <h1>Every conversation,<br /><em>operational.</em></h1>
        </div>
        <div className={styles.heroCopy}>
          <p>Connect your business, organize opted-in customers, shape approved templates and send with confidence—from one beautifully focused workspace.</p>
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.solidButton}>Create workspace <ArrowRight size={15} /></Link>
            <a href="#demo" className={styles.textButton}><CirclePlay size={17} /> See how it works</a>
          </div>
        </div>
      </header>

      <section id="demo" className={styles.demoSection}>
        <div className={styles.demoMeta}><span>PRODUCT FILM / 01:08</span><span>FROM SETUP TO SENT</span></div>
        <div className={styles.demoFrame}>
          <div className={styles.browserChrome}><div><i /><i /><i /></div><span>app.engage / workspace</span><span>SECURE</span></div>
          <div className={styles.productShell}>
            <aside className={styles.demoSidebar}>
              <div className={styles.demoBrand}><BrandMark inverse /><strong>Engage</strong></div>
              <nav>{[[MessageSquareText,"Overview"],[ShieldCheck,"Onboarding"],[ContactRound,"Contacts"],[FileCheck2,"Templates"],[Send,"Send"]].map(([Icon,label], index) => <span key={label} className={index === active + 1 || (active === 3 && index === 4) ? styles.activeSideItem : ""}><Icon size={15} />{label}</span>)}</nav>
              <div className={styles.connected}><i /> WhatsApp connected</div>
            </aside>
            <div className={styles.demoStage}>
              <div className={styles.stageTop}><div><span>{chapters[active].kicker}</span><strong>Acme Retail</strong></div><span className={styles.teamAvatar}>AR</span></div>
              <DemoContent active={active} />
            </div>
          </div>
        </div>
        <div className={styles.chapterBar}>
          <button className={styles.playButton} onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause demo" : "Play demo"}>{playing ? <CirclePause size={22} /> : <CirclePlay size={22} />}</button>
          {chapters.map((chapter, index) => <button key={chapter.label} className={index === active ? styles.activeChapter : ""} onClick={() => selectChapter(index)}><span>0{index + 1}</span>{chapter.label}<i /></button>)}
        </div>
      </section>

      <section id="workflow" className={styles.workflowSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.microLabel}><span /> THE OPERATING FLOW</p>
          <h2>From blank workspace<br />to delivered message.</h2>
          <p>Four clear movements. One continuous experience. Each step keeps the next one ready.</p>
          <Link href="/signup" className={styles.smallOutline}>TRY THE WORKFLOW <ArrowRight size={13} /></Link>
        </div>
        <div className={styles.journeyList}>
          {journeys.map((item, index) => {
            const isOpen = openJourney === index;
            return (
              <button key={item.number} className={`${styles.journeyItem} ${isOpen ? styles.openJourney : ""}`} onClick={() => setOpenJourney(index)} aria-expanded={isOpen}>
                <span className={styles.journeyNumber}>{item.number}.</span>
                <span className={styles.journeyBody}><strong>{item.title}</strong><span>{item.summary}</span>{isOpen ? <em>{item.detail}</em> : null}</span>
                <span className={styles.journeyTag}>{item.tag}</span><span className={styles.journeyIcon}>{isOpen ? "●" : "○"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="principles" className={styles.principlesSection}>
        <div className={styles.principleTitle}><p>ENGAGE / FIELD NOTE 001</p><h2>Messaging work deserves<br />a proper place to happen.</h2></div>
        <div className={styles.principleCopy}>
          <p>Customer communication is too important to live across spreadsheets, browser tabs and copied credentials.</p>
          <p>Engage puts the whole operation on one surface: who you can contact, what you can say, what is ready to send, and what happened next.</p>
          <div className={styles.signature}><BrandMark /><span>Built for teams who care about the details.<small>ENGAGE PRODUCT STUDIO · 2026</small></span></div>
        </div>
        <div className={styles.principleStamp}><Sparkles size={20} /><span>ONE PLACE.<br />EVERY MESSAGE.</span></div>
      </section>

      <footer className={styles.footer}>
        <div><BrandMark /><strong>ENGAGE</strong><span>WhatsApp operations, beautifully organized.</span></div>
        <nav><Link href="/login">Sign in</Link><Link href="/signup">Create workspace</Link><a href="#demo">Watch demo</a></nav>
        <Link href="/signup" className={styles.footerCta}>Start now <ChevronRight size={18} /></Link>
        <p>© 2026 Engage. Built for modern messaging teams.</p>
      </footer>
    </main>
  );
}
