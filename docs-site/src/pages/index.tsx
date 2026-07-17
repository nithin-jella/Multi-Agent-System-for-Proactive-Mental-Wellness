import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

const features: FeatureItem[] = [
  {
    icon: '🤖',
    title: 'Aika — The Orchestrator',
    description:
      'A conversational AI that acts as the front-door for every student. Aika understands your message, decides what kind of help you need, and quietly coordinates a team of specialist agents behind the scenes.',
  },
  {
    icon: '🛡️',
    title: 'Real-Time Safety Triage',
    description:
      'Every message is scanned in milliseconds. The Safety Triage Agent (STA) combines keyword checks with Gemini-based intent and risk classification before any response reaches you.',
  },
  {
    icon: '🧠',
    title: 'Evidence-Based Coaching',
    description:
      'The Therapeutic Coach Agent (TCA) delivers structured support grounded in Cognitive Behavioural Therapy (CBT). Think personalised coping plans, not generic advice.',
  },
  {
    icon: '📋',
    title: 'Seamless Human Handoff',
    description:
      'When a professional counsellor is needed, the Case Management Agent (CMA) handles everything: opening a case, finding the right counsellor, scheduling an appointment, and tracking follow-ups.',
  },
  {
    icon: '📊',
    title: 'Privacy-First Analytics',
    description:
      'The Insights Agent (IA) gives counsellors and administrators a population-level view of mental health trends — without ever exposing individual identities, using k-anonymity and differential privacy.',
  },
  {
    icon: '⛓️',
    title: 'Blockchain Accountability',
    description:
      'Counsellor attestations are anchored on-chain with CARE tokens, creating a tamper-evident audit trail that institutions can trust.',
  },
];

function Feature({icon, title, description}: FeatureItem): ReactNode {
  return (
    <div className={clsx('col col--4', styles.featureCol)}>
      <div className={styles.featureCard}>
        <span className={styles.featureIcon}>{icon}</span>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDesc}>{description}</p>
      </div>
    </div>
  );
}

function HomepageHero(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.heroButtons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Read the Docs
          </Link>
          <Link
            className={clsx('button button--outline button--lg', styles.heroButtonOutline)}
            to="/docs/architecture/system-overview">
            Explore the Architecture
          </Link>
        </div>
        <div className={styles.heroBadges}>
          <span className={styles.badge}>LangGraph</span>
          <span className={styles.badge}>Gemini 2.5</span>
          <span className={styles.badge}>FastAPI</span>
          <span className={styles.badge}>Next.js</span>
          <span className={styles.badge}>PostgreSQL</span>
          <span className={styles.badge}>Redis</span>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="UGM-AICare Documentation"
      description="Technical documentation for the UGM-AICare agentic mental health support platform - architecture, agent design, API reference, and deployment guides.">
      <HomepageHero />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <Heading as="h2">What the System Does</Heading>
              <p>
                UGM-AICare is not a single chatbot. It is a coordinated team of AI agents,
                each with a distinct clinical role, working together to support
                students at Universitas Gadjah Mada.
              </p>
            </div>
            <div className="row">
              {features.map((feature) => (
                <Feature key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.quickLinks}>
          <div className="container">
            <Heading as="h2">Where to Start</Heading>
            <div className="row">
              <div className="col col--4">
                <Link to="/docs/intro" className={styles.quickLink}>
                  <strong>New here?</strong>
                  <span>Start with the introduction to understand the problem this system solves.</span>
                </Link>
              </div>
              <div className="col col--4">
                <Link to="/docs/architecture/system-overview" className={styles.quickLink}>
                  <strong>Understand the design</strong>
                  <span>Read the system architecture - how all the pieces fit together.</span>
                </Link>
              </div>
              <div className="col col--4">
                <Link to="/docs/architecture/meta-agent-aika" className={styles.quickLink}>
                  <strong>Meet the agents</strong>
                  <span>Deep-dive into each AI agent - what it does and how it thinks.</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
