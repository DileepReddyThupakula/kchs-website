import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/reveal";
import SiteHeader, { SchoolMark } from "@/components/site-header";
import { formatNoticeDate, getPublicNotices, noticePriorityLabels } from "@/lib/notices";
import { eventTypeLabels, formatEventDate, formatEventTime, getPublicEvents } from "@/lib/events";
import { schoolContact } from "@/lib/school";

const programmes = [["01", "Early Years", "Nursery · LKG · UKG", "Playful discovery, language-rich experiences and gentle routines that make a child’s first years of school joyful."], ["02", "Primary School", "Classes 1–5", "Core literacy, numeracy and exploration come together to develop capable, curious young learners."], ["03", "High School", "Classes 6–10", "Focused State Board preparation, independent thinking and responsible habits for life beyond school."]];

export default async function Home() {
  const [notices, events] = await Promise.all([getPublicNotices(), getPublicEvents()]);
  return (
    <main>
      <SiteHeader />
      <motion.section
        className="hero"
        id="top"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <Image
          src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1800&q=85"
          alt="Decorative classroom imagery"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-overlay" />
        <motion.div
          className="hero-content hero-entrance"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="eyebrow light">Established 2001 · State Board · English Medium</p>
          <h1>Excellence in<br /><em>Education Since 2001.</em></h1>
          <p className="hero-copy">A place where curiosity becomes confidence and every learner is prepared to grow with purpose.</p>
          <div className="hero-actions">
            <motion.Link
              asChild
              href="/admissions#enquiry"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link className="button gold">Begin an Enquiry <span>→</span></Link>
            </motion.Link>
            <motion.a
              href="#about"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <a className="text-link">Discover our school <span>↓</span></a>
            </motion.a>
          </div>
        </motion.div>
        <motion.div
          className="hero-ribbon"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <span>LEARN</span><i>•</i><span>GROW</span><i>•</i><span>EXCEL</span>
        </motion.div>
      </motion.section>
  );
}

    <section className="intro section" id="about"><Reveal><p className="eyebrow">Our Foundation</p><h2>Rooted in values.<br /><em>Focused on futures.</em></h2></Reveal><Reveal className="intro-copy" delay={90}><p>Krishna Chaitanya High School is a trusted learning community on Vempalli Road, Yerraguntla. Since 2001, we have combined academic discipline with an environment where children feel seen, supported and inspired.</p><p>Our English Medium, State Board programme serves learners from Nursery through Class 10—building strong foundations for each child&apos;s next chapter.</p><a className="arrow-link" href="#academics">Explore academics <span>→</span></a></Reveal></section>
    <section className="legacy-strip"><div><span>25</span><p>Years of<br />learning</p></div><div><span>2001</span><p>Our founding<br />year</p></div><div><span>N–10</span><p>A complete<br />school journey</p></div><p className="legacy-copy">A clear beginning. A meaningful education. <em>One enduring purpose.</em></p></section>

    <section className="academics section" id="academics"><Reveal className="section-heading"><p className="eyebrow">Academic Journey</p><h2>Learning that meets<br />children <em>where they are.</em></h2></Reveal><div className="program-grid">{programmes.map(([number, title, age, text], index) => <motion.div
  key={title}
  initial={{ y: 20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.6, delay: index * 0.05 }}
  whileHover={{ scale: 1.02, y: -5 }}
  whileTap={{ scale: 0.98 }}
>
  <article>
    <span className="number">{number}</span>
    <h3>{title}</h3>
    <p className="program-age">{age}</p>
    <p>{text}</p>
  </article>
</motion.div>)}</div></section>
    <section className="philosophy"><div className="philosophy-content"><Reveal><p className="eyebrow light">Our Educational Philosophy</p><h2>Ambition with<br /><em>character.</em></h2><p>We believe a good school prepares children for more than examinations. It helps them think clearly, act kindly and meet the world with confidence.</p></Reveal></div><div className="value-list">{[80, 150, 220].map((delay, index) => {
  const values = [
    { number: "01", title: "Curiosity", text: "Questions are where meaningful learning begins." },
    { number: "02", title: "Discipline", text: "Small, consistent efforts build lasting confidence." },
    { number: "03", title: "Respect", text: "For self, for others and for the work of learning." }
  ];
  const value = values[index];
  return (
    <motion.div
      key={value.number}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: delay / 1000 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <span>{value.number}</span>
      <h3>{value.title}</h3>
      <p>{value.text}</p>
    </motion.div>
  );
})}</div></section>

    <section className="message section" id="message">
  <motion.div
    className="portrait"
    initial={{ x: -100, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.8, delay: 0.2 }}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <Image src="/images/principal.png" alt="Thupakula Rama Mohana Reddy, Principal" fill sizes="(max-width: 700px) 86vw, 39vw" />
    <span>Principal&apos;s Desk</span>
  </motion.div>
  <motion.div
    className="message-copy"
    initial={{ x: 100, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.8, delay: 0.4 }}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <p className="eyebrow">A Message from the Principal</p>
    <blockquote>“Education is not simply preparation for life—it is the patient work of helping a child discover their own strength.”</blockquote>
    <p>At Krishna Chaitanya High School, we believe that meaningful education is built through strong values, consistent effort and genuine care. Our commitment is to give every learner the attention, encouragement and opportunities they need to excel.</p>
    <p>We invite families to be part of a school community that values both achievement and character.</p>
    <div className="signature">
      <strong>Thupakula Rama Mohana Reddy</strong>
      <span>Principal · Krishna Chaitanya High School</span>
    </div>
  </motion.div>
</section>
    <section className="highlights section"><Reveal><p className="eyebrow">The KCHS Experience</p><h2>A school designed for<br /><em>steady growth.</em></h2></Reveal><div className="highlights-grid">{[["01","English Medium","Confident communication woven through the school day."],["02","State Board","A robust, well-structured foundation in core subjects."],["03","Whole Child","Academic focus balanced with values and wellbeing."],["04","Since 2001","A lasting commitment to the families of Yerraguntla."]].map(([number,title,text],index)=><motion.div
  key={title}
  initial={{ y: 20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.6, delay: index * 0.05 }}
  whileHover={{ scale: 1.02, y: -3 }}
  whileTap={{ scale: 0.98 }}
>
  <article>
    <b>{number}</b>
    <h3>{title}</h3>
    <p>{text}</p>
  </article>
</motion.div>)}</div></section>
    <section className="notices section" id="notices"><Reveal className="section-heading"><p className="eyebrow">Latest Updates</p><h2>What&apos;s happening<br /><em>at KCHS.</em></h2></Reveal><div className="notice-list">{notices.length ? notices.map((notice, index) => (
  <motion.div
    key={notice.id}
    initial={{ x: -20, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.6, delay: index * 0.08 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <article>
      <div>
        <span className="notice-tag">{noticePriorityLabels[notice.priority]} · {formatNoticeDate(notice.published_at)}</span>
        <h3>{notice.title}</h3>
        {notice.summary && <p>{notice.summary}</p>}
      </div>
      <span className="notice-arrow" aria-hidden="true">✦</span>
    </article>
  </motion.div>
)) : (
  <motion.div
    delay={80}
    initial={{ x: -20, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.6 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <article className="public-notice-empty">
      <div>
        <span className="notice-tag">School updates</span>
        <h3>Stay connected with KCHS.</h3>
        <p>Important school notices and announcements will be shared here.</p>
      </div>
    </article>
  </motion.div>
)}</div></section>
    <section className="public-events section" id="events"><Reveal className="section-heading"><p className="eyebrow">School Calendar</p><h2>Upcoming events<br /><em>at KCHS.</em></h2></Reveal><div className="public-events-grid">{events.length ? events.map((event, index) => (
  <motion.div
    key={event.id}
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.6, delay: index * 0.075 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <article className="public-event-card">
      <div>
        <span className="public-event-type">{eventTypeLabels[event.event_type]}</span>
        <h3>{event.title}</h3>
      </div>
      <div className="public-event-date">
        <strong>{formatEventDate(event.start_at)}</strong>
        <span>{formatEventTime(event.start_at)} IST{event.location && <> · {event.location}</>}</span>
      </div>
    </article>
  </motion.div>
)) : (
  <motion.div
    delay={75}
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.6 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <article className="public-event-card">
      <div>
        <span className="public-event-type">School calendar</span>
        <h3>Our next school events will be shared here.</h3>
      </div>
      <p>Stay connected for academic, cultural and community updates from KCHS.</p>
    </article>
  </motion.div>
)}</div></section>
    <section className="admissions" id="admissions">
  <motion.div
    initial={{ y: 50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.8, delay: 0.2 }}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <Reveal>
      <p className="eyebrow light">Admissions Enquiries</p>
      <h2>Give their potential<br />a place to <em>shine.</em></h2>
      <p>Speak with our school team to learn more about admissions, academics and life at KCHS.</p>
    </Reveal>
  </motion.div>
  <motion.div
    delay={120}
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.6 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <Reveal>
      <Link className="button gold" href="/contact">Contact the School <span>→</span></Link>
    </Reveal>
  </motion.div>
</section>
    <section className="contact section" id="contact">
  <motion.div
    initial={{ y: 50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.8, delay: 0.2 }}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <Reveal>
      <p className="eyebrow">Visit & Connect</p>
      <h2>We&apos;d be glad<br />to welcome <em>you.</em></h2>
    </Reveal>
  </motion.div>
  <motion.div
    className="contact-grid"
    initial={{ x: -20, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.6, delay: 0.4 }}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
  >
    <Reveal className="contact-grid" delay={100}>
      <div>
        <span>School Address</span>
        <p>Vempalli Road<br />Yerraguntla, Andhra Pradesh<br /><a href={schoolContact.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Open Krishna Chaitanya High School in Google Maps">Get Directions ↗</a></p>
      </div>
      <div>
        <span>Phone</span>
        <p><a href={schoolContact.phoneHref}>{schoolContact.phoneDisplay}</a></p>
      </div>
      <div>
        <span>Admissions</span>
        <p><Link href="/admissions#enquiry">Begin an enquiry →</Link></p>
      </div>
      <div>
        <span>School Profile</span>
        <p>State Board · English Medium<br />Nursery to Class 10</p>
      </div>
    </Reveal>
  </motion.div>
</section>
    <motion.footer
  initial={{ y: 50, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.8, delay: 0.2 }}
  whileHover={{ scale: 1.01 }}
  whileTap={{ scale: 0.99 }}
>
  <div className="footer-brand"><SchoolMark dark /></div>
  <p>© {new Date().getFullYear()} Krishna Chaitanya High School. All rights reserved.</p>
  <Link href="/login">Staff portal →</Link>
</motion.footer>
  </main>;
}
