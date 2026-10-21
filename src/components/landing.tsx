"use client";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Code2,
  PenTool,
  Camera,
  Languages,
  Music2,
  BriefcaseBusiness,
  Sparkles,
  Repeat2,
  Check,
  Sprout,
} from "lucide-react";
import { Brand, Reveal, Tag, Avatar } from "./ui";
import { useData, useSession } from "./provider";
import { defaultSettings, type Profile, type Settings } from "@/lib/model";
export function Landing() {
  const { user } = useSession();
  const { data: config } = useData<Settings>("kind=settings");
  const s = config || defaultSettings;
  const { data: people } = useData<{ items: Profile[] }>("kind=people");
  const topics = [
    {
      name: "Programming",
      icon: Code2,
      description: "Build your next big idea",
      skill: "React",
    },
    {
      name: "Design",
      icon: PenTool,
      description: "Make things people love",
      skill: "UI/UX design",
    },
    {
      name: "Languages",
      icon: Languages,
      description: "Open up a new world",
      skill: "Spanish",
    },
    {
      name: "Photography & Video",
      icon: Camera,
      description: "Find a different perspective",
      skill: "Photography",
    },
    {
      name: "Music",
      icon: Music2,
      description: "Get into your own rhythm",
      skill: "Guitar",
    },
    {
      name: "Business",
      icon: BriefcaseBusiness,
      description: "Turn ambition into action",
      skill: "Entrepreneurship",
    },
  ];
  return (
    <>
      <header className="public-header">
        <Brand name={s.brand} />
        <nav aria-label="Main navigation">
          <Link href="/discover">Explore skills</Link>
          <a href="#how-it-works">How it works</a>
          <a href="#community">Our community</a>
        </nav>
        <div className="header-actions">
          {user ? (
            <Link href="/dashboard" className="button small">
              My dashboard <ChevronRight size={16} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="login-link">
                Log in
              </Link>
              <Link href="/signup" className="button small">
                Join the community <ChevronRight size={16} />
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main">
        <section className="hero wrap">
          <Reveal className="hero-copy">
            <span className="eyebrow pill">
              <span className="live-dot" />
              GOOD THINGS GROW TOGETHER
            </span>
            <h1>
              You know something.
              <br />
              Someone wants
              <br />
              to <em>learn it.</em>
              <span className="hand-spark">✳</span>
            </h1>
            <p>
              Trade what you know for what you’re curious about. Meet people,
              share your skills, and grow in a way you couldn’t on your own.
            </p>
            <div className="row hero-actions">
              <Link href="/signup" className="button">
                Start Exchanging Skills <ChevronRight size={19} />
              </Link>
              <Link href="/discover" className="button secondary">
                Explore Skills <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-footnote">
              <span>
                <Check size={15} /> No expert title needed
              </span>
              <span>
                <Check size={15} /> Built on give and take
              </span>
            </div>
          </Reveal>
          <Reveal className="connection-scene">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="floating-label label-top">
              <span className="live-dot" />A little give. A lot of growth.
            </span>
            <article className="example-person person-a">
              <div className="example-avatar avatar-a">
                A<span>✦</span>
              </div>
              <div>
                <small>MEET ALEX</small>
                <h3>The builder.</h3>
                <p>Curious about good design.</p>
              </div>
              <div className="example-skill">
                <Code2 size={19} />
                <span>
                  <small>CAN SHARE</small>React development
                </span>
              </div>
              <div className="example-wants">
                Wants to learn <b>UI/UX design</b>
              </div>
            </article>
            <span className="exchange-node">
              <Repeat2 size={30} />
            </span>
            <article className="example-person person-b">
              <div className="example-avatar avatar-b">
                J<span>↗</span>
              </div>
              <div>
                <small>MEET JAMIE</small>
                <h3>The designer.</h3>
                <p>Ready to bring ideas to life.</p>
              </div>
              <div className="example-skill">
                <PenTool size={19} />
                <span>
                  <small>CAN SHARE</small>UI/UX design
                </span>
              </div>
              <div className="example-wants">
                Wants to learn <b>React development</b>
              </div>
            </article>
            <span className="floating-label label-bottom">
              <Sparkles size={16} />
              Different skills. A perfect place to start.
            </span>
            <small className="illustration-label">
              An illustrative exchange, not member endorsements.
            </small>
          </Reveal>
        </section>
        <div className="principles-strip">
          <div className="wrap">
            <span>Knowledge is better shared.</span>
            <b>
              Human connections <Sprout size={17} />
            </b>
            <b>
              Mutual growth <Repeat2 size={17} />
            </b>
            <b>
              Practical learning <Sparkles size={17} />
            </b>
            <b>
              New possibilities <ChevronRight size={17} />
            </b>
          </div>
        </div>
        <section className="section wrap" id="how-it-works">
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">LESS SCROLLING. MORE GROWING.</p>
              <h2>
                Your next chapter
                <br />
                starts with a conversation.
              </h2>
            </div>
            <p>
              No complicated process. Just something you can share, something
              you’d love to learn, and someone to do it with.
            </p>
          </Reveal>
          <div className="steps-grid">
            {[
              {
                n: "01",
                title: "Bring your kind of brilliant.",
                text: "Create a profile. Add the skills you can share and the things you’re curious to learn.",
                icon: Sprout,
              },
              {
                n: "02",
                title: "Find your learning counterpart.",
                text: "Explore people with complementary skills. See exactly why you could be a good match.",
                icon: Repeat2,
              },
              {
                n: "03",
                title: "Make a little time for growth.",
                text: "Send a request, agree on a schedule, and start learning. Share feedback as you go.",
                icon: Sparkles,
              },
            ].map((x) => (
              <Reveal className="step-card" key={x.n}>
                <span className="step-number">{x.n}</span>
                <x.icon size={28} />
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </Reveal>
            ))}
          </div>
        </section>
        <section className="section category-section">
          <div className="wrap">
            <Reveal className="section-heading">
              <div>
                <p className="eyebrow">FOLLOW YOUR CURIOSITY</p>
                <h2>What will you learn next?</h2>
              </div>
              <Link href="/discover" className="text-link">
                Explore all skills <ChevronRight size={18} />
              </Link>
            </Reveal>
            <div className="category-grid">
              {topics.map((c, i) => (
                <Reveal key={c.name}>
                  <Link
                    href={`/discover?category=${encodeURIComponent(c.name)}`}
                    className="category-card"
                  >
                    <span className={`category-icon color-${i}`}>
                      <c.icon size={25} />
                    </span>
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    <ChevronRight className="category-arrow" size={21} />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section className="section wrap" id="community">
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">REAL PEOPLE. DIFFERENT PERSPECTIVES.</p>
              <h2>Your people are out there.</h2>
            </div>
            <Link href="/discover" className="text-link">
              Meet the community <ChevronRight size={18} />
            </Link>
          </Reveal>
          {people?.items.length ? (
            <div className="people-grid">
              {people.items.slice(0, 3).map((p) => (
                <Reveal key={p.id}>
                  <Link className="member-card" href={`/people/${p.username}`}>
                    <div className="row">
                      <Avatar person={p} />
                      <div>
                        <h3>{p.name}</h3>
                        <p>{p.headline || p.role}</p>
                      </div>
                    </div>
                    <p className="member-bio">{p.bio}</p>
                    <small>HAPPY TO SHARE</small>
                    <div className="tags">
                      {p.offered.slice(0, 3).map((s) => (
                        <Tag key={s.name}>{s.name}</Tag>
                      ))}
                    </div>
                    <small>CURIOUS ABOUT</small>
                    <p>
                      {p.wanted.map((s) => s.name).join(" · ") ||
                        "One-way mentoring"}
                    </p>
                    <span className="text-link">
                      Meet {p.name.split(" ")[0]} <ChevronRight size={16} />
                    </span>
                    {p.demo && <Tag>Demo profile</Tag>}
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="community-start">
              <div className="large-sprout">
                <Sprout size={60} />
              </div>
              <div>
                <h3>Every community starts with someone.</h3>
                <p>
                  Be among the first to put your knowledge out there. Your next
                  collaborator might be looking for exactly what you know.
                </p>
                <Link href="/signup" className="text-link">
                  Make the first connection <ChevronRight size={18} />
                </Link>
              </div>
            </div>
          )}
        </section>
        <section className="benefit-section wrap">
          <Reveal className="benefit-copy">
            <p className="eyebrow">NOT ANOTHER COURSE TO FINISH</p>
            <h2>
              Learn with someone.
              <br />
              <em>Not just from someone.</em>
            </h2>
            <p>
              Ask the question you wouldn’t ask in a classroom. Try something,
              get honest feedback, and teach a little along the way.
            </p>
            <ul>
              <li>
                <Check />
                Learning shaped around your goals
              </li>
              <li>
                <Check />
                Practical knowledge, personal attention
              </li>
              <li>
                <Check />
                Connections that go beyond the session
              </li>
            </ul>
            <Link href="/discover" className="button">
              Find your next connection <ChevronRight size={18} />
            </Link>
          </Reveal>
          <Reveal className="quote-card">
            <span className="quote-mark">“</span>
            <blockquote>
              I could help someone build their first website, while they help me
              finally find my voice in Spanish.
            </blockquote>
            <div className="quote-caption">
              <span className="avatar">SS</span>
              <span>
                A possible first exchange
                <small>Illustrative community story · not a real review</small>
              </span>
            </div>
          </Reveal>
        </section>
        <section className="section wrap">
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">FRESH POSSIBILITIES</p>
              <h2>Start with a skill. See where it goes.</h2>
            </div>
            <p>
              Explore recently updated offers or get recommendations based on
              your own learning goals.
            </p>
          </Reveal>
          <div className="discovery-pair">
            <Link href="/discover?sort=recent">
              <Code2 />
              <div>
                <h3>Recently shared skills</h3>
                <p>Find the community’s latest offers.</p>
              </div>
              <ChevronRight />
            </Link>
            <Link href={user ? "/matches" : "/signup"}>
              <Repeat2 />
              <div>
                <h3>Made-for-you exchanges</h3>
                <p>Understand the connection, not a mystery percentage.</p>
              </div>
              <ChevronRight />
            </Link>
          </div>
        </section>
        <section className="section wrap faq-section">
          <div>
            <p className="eyebrow">A FEW THINGS YOU MIGHT WONDER</p>
            <h2>
              Good questions.
              <br />
              Honest answers.
            </h2>
          </div>
          <div className="faq-list">
            {s.faq.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <span>+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing-section wrap">
          <Sprout size={36} />
          <h2>
            Your next skill starts
            <br />
            with <em>someone like you.</em>
          </h2>
          <p>
            You don’t need to know everything. Just start with what you know.
          </p>
          <Link href="/signup" className="button lime">
            Start Exchanging Skills <ChevronRight size={20} />
          </Link>
        </section>
      </main>
      <footer className="footer wrap">
        <div>
          <Brand name={s.brand} />
          <p>{s.tagline}</p>
          <small>
            © {new Date().getFullYear()} {s.brand}
          </small>
        </div>
        <nav aria-label="Footer">
          <Link href="/discover">Explore skills</Link>
          <Link href="/guidelines">Community guidelines</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </>
  );
}
