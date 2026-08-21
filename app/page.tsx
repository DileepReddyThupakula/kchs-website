import Image from "next/image";
import Link from "next/link";

const notices = [
  ["Admissions", "Admissions open for the 2026–27 academic year", "Enquiries welcome for Nursery through Class 10."],
  ["Academic", "A purposeful learning journey at every stage", "A structured State Board curriculum with care and high expectations."],
  ["Community", "Stay connected with school updates", "Important dates and announcements will be shared here."],
];

function Crest() { return <span className="crest" aria-hidden="true"><b>K</b><i>CHS</i></span>; }

export default function Home() {
  return <main>
    <header className="site-header">
      <Link href="#top" className="brand" aria-label="Krishna Chaitanya High School home"><Crest /><span><strong>Krishna Chaitanya</strong><small>HIGH SCHOOL · YERRAGUNTLA</small></span></Link>
      <nav aria-label="Main navigation"><a href="#about">About</a><a href="#academics">Academics</a><a href="#message">Principal&apos;s Desk</a><a href="#notices">Notices</a><a href="#contact">Contact</a></nav>
      <Link className="staff-login" href="/login">Staff Login <span>→</span></Link>
    </header>

    <section className="hero" id="top">
      <Image src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1800&q=85" alt="Students learning together in a bright classroom" fill priority sizes="100vw" />
      <div className="hero-overlay" />
      <div className="hero-content"><p className="eyebrow light">Established 2001 · State Board · English Medium</p><h1>Excellence in<br /><em>Education Since 2001.</em></h1><p className="hero-copy">A place where curiosity becomes confidence and every learner is prepared to grow with purpose.</p><div className="hero-actions"><a className="button gold" href="#admissions">Begin an Enquiry <span>→</span></a><a className="text-link" href="#about">Discover our school <span>↓</span></a></div></div>
      <div className="hero-ribbon"><span>LEARN</span><i>•</i><span>GROW</span><i>•</i><span>EXCEL</span></div>
    </section>

    <section className="intro section" id="about"><div><p className="eyebrow">Our Foundation</p><h2>Rooted in values.<br /><em>Focused on futures.</em></h2></div><div className="intro-copy"><p>Krishna Chaitanya High School is a trusted learning community on Vempalli Road, Yerraguntla. Since 2001, we have combined academic discipline with an environment where children feel seen, supported and inspired.</p><p>Our English Medium, State Board programme serves learners from Nursery through Class 10—building strong foundations for each child&apos;s next chapter.</p><a className="arrow-link" href="#academics">Explore academics <span>→</span></a></div></section>

    <section className="academics section" id="academics"><div className="section-heading"><p className="eyebrow">Academic Journey</p><h2>Learning that meets<br />children <em>where they are.</em></h2></div><div className="program-grid">
      <article><span className="number">01</span><h3>Early Years</h3><p className="program-age">Nursery · LKG · UKG</p><p>Playful discovery, language-rich experiences and gentle routines that make the first years of school joyful.</p></article>
      <article><span className="number">02</span><h3>Primary School</h3><p className="program-age">Classes 1–5</p><p>Core literacy, numeracy and exploration come together to develop capable, curious young learners.</p></article>
      <article><span className="number">03</span><h3>High School</h3><p className="program-age">Classes 6–10</p><p>Focused State Board preparation, independent thinking and responsible habits for life beyond school.</p></article>
    </div></section>

    <section className="image-break"><Image src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1800&q=85" alt="Teacher helping a student with school work" fill sizes="100vw" /><div><p className="eyebrow light">A culture of possibility</p><h2>Every child deserves<br />to feel <em>capable.</em></h2></div></section>

    <section className="message section" id="message"><div className="portrait"><Image src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1000&q=85" alt="Placeholder portrait for the school principal" fill sizes="(max-width: 700px) 100vw, 40vw" /><span>Principal&apos;s Desk</span></div><div className="message-copy"><p className="eyebrow">A Message from the Principal</p><blockquote>“Education is not simply preparation for life—it is the patient work of helping a child discover their own strength.”</blockquote><p>At Krishna Chaitanya High School, we believe that meaningful education is built through strong values, consistent effort and genuine care. Our commitment is to give every learner the attention, encouragement and opportunities they need to excel.</p><p>We invite families to be part of a school community that values both achievement and character.</p><div className="signature"><strong>Thupakula Rama Mohana Reddy</strong><span>Principal · Krishna Chaitanya High School</span></div></div></section>

    <section className="notices section" id="notices"><div className="section-heading"><p className="eyebrow">Notice Board</p><h2>What&apos;s happening<br /><em>at KCHS.</em></h2></div><div className="notice-list">{notices.map(([tag, title, text]) => <article key={title}><div><span className="notice-tag">{tag}</span><h3>{title}</h3><p>{text}</p></div><span className="notice-arrow">↗</span></article>)}</div></section>

    <section className="admissions" id="admissions"><div><p className="eyebrow light">Admissions Enquiries</p><h2>Give their potential<br />a place to <em>shine.</em></h2><p>Speak with our school team to learn more about admissions, academics and life at KCHS.</p></div><a className="button gold" href="#contact">Contact the School <span>→</span></a></section>

    <section className="contact section" id="contact"><div><p className="eyebrow">Visit & Connect</p><h2>We&apos;d be glad<br />to welcome <em>you.</em></h2></div><div className="contact-grid"><div><span>School Address</span><p>Vempalli Road<br />Yerraguntla, Andhra Pradesh</p></div><div><span>Admissions</span><p>Contact the school office<br />for current admission details.</p></div><div><span>School Profile</span><p>State Board · English Medium<br />Nursery to Class 10</p></div></div></section>
    <footer><div className="footer-brand"><Crest /><span><strong>Krishna Chaitanya High School</strong><small>LEARN · GROW · EXCEL</small></span></div><p>© {new Date().getFullYear()} Krishna Chaitanya High School. All rights reserved.</p><Link href="/login">Staff portal →</Link></footer>
  </main>;
}
