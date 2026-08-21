import type { Metadata } from "next";
import Link from "next/link";
import AdmissionForm from "@/components/admission-form";
import SiteHeader, { SchoolMark } from "@/components/site-header";

export const metadata: Metadata = { title: "Admissions 2026–27", description: "Admissions enquiries for Nursery through Class 10 at Krishna Chaitanya High School, Yerraguntla." };

export default function AdmissionsPage() {
  return <main><SiteHeader />
    <section className="interior-hero admissions-hero"><div><p className="eyebrow light">Admissions · Academic Year 2026–27</p><h1>Begin their journey<br />at <em>KCHS.</em></h1><p>For families seeking an English Medium, State Board education from Nursery through Class 10.</p><a href="#enquiry" className="button gold">Make an Enquiry <span>↓</span></a></div></section>
    <section className="admissions-intro interior-section"><div><p className="eyebrow">A thoughtful beginning</p><h2>Every journey starts<br />with a <em>conversation.</em></h2></div><div><p>We welcome families who are exploring the next step in their child&apos;s education. Our admissions process is designed to be clear, personal and straightforward.</p><dl><div><dt>Academic year</dt><dd>2026–27</dd></div><div><dt>Curriculum</dt><dd>State Board</dd></div><div><dt>Medium</dt><dd>English Medium</dd></div><div><dt>Classes</dt><dd>Nursery to Class 10</dd></div></dl></div></section>
    <section className="process-section interior-section"><div><p className="eyebrow">Admissions Process</p><h2>A clear path<br />forward.</h2></div><ol>{[["01","Submit an enquiry","Tell us a little about your child and the class you are considering."],["02","Speak with the school","Our team can share the next available information with you."],["03","Visit & discuss admission","Arrange a school conversation when the relevant details are available."],["04","Complete formalities","The school office will guide eligible families through the next steps."]].map(([number,title,text]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <section className="enquiry-section interior-section" id="enquiry"><AdmissionForm /></section>
    <section className="admissions-closer"><div><p className="eyebrow light">Have a question first?</p><h2>We&apos;re here to<br /><em>help.</em></h2></div><Link href="/contact" className="button gold">Visit & Contact <span>→</span></Link></section>
    <footer><div className="footer-brand"><SchoolMark dark /></div><p>© {new Date().getFullYear()} Krishna Chaitanya High School. All rights reserved.</p><Link href="/login">Staff portal →</Link></footer>
  </main>;
}
