import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader, { SchoolMark } from "@/components/site-header";
import { schoolContact } from "@/lib/school";

export const metadata: Metadata = { title: "Contact", description: "Visit Krishna Chaitanya High School on Vempalli Road, Yerraguntla, Andhra Pradesh." };

export default function ContactPage() {
  return <main><SiteHeader />
    <section className="interior-hero contact-hero"><div><p className="eyebrow light">Krishna Chaitanya High School</p><h1>Come and<br /><em>visit us.</em></h1><p>We would be glad to welcome you to our school community in Yerraguntla.</p></div></section>
    <section className="contact-page-grid interior-section"><div><p className="eyebrow">Visit the school</p><h2>A local school with<br />a lasting <em>purpose.</em></h2><p className="address-copy">Vempalli Road<br />Yerraguntla, Andhra Pradesh</p><div className="map-placeholder"><span>Location</span><strong>Krishna Chaitanya High School</strong><p>Vempalli Road<br />Yerraguntla, Andhra Pradesh</p><a href={schoolContact.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Open Krishna Chaitanya High School in Google Maps">Get Directions ↗</a></div></div><div className="contact-details"><article><span>Admissions enquiries</span><h3>Considering KCHS?</h3><p>Begin with a short enquiry and the school can share the next available information.</p><Link href="/admissions#enquiry">Begin an enquiry →</Link></article><article><span>General enquiries</span><h3>Need to get in touch?</h3><a className="contact-phone" href={schoolContact.phoneHref}>{schoolContact.phoneDisplay}</a><a className="contact-call" href={schoolContact.phoneHref}>Call School →</a></article><article><span>School profile</span><h3>Krishna Chaitanya High School</h3><p>Established 2001 · State Board · English Medium · Nursery to Class 10</p></article></div></section>
    <section className="contact-closer"><p className="eyebrow light">Admissions 2026–27</p><h2>Help your child begin<br />with <em>confidence.</em></h2><Link href="/admissions" className="button gold">Explore Admissions <span>→</span></Link></section>
    <footer><div className="footer-brand"><SchoolMark dark /></div><p>© {new Date().getFullYear()} Krishna Chaitanya High School. All rights reserved.</p><Link href="/login">Staff portal →</Link></footer>
  </main>;
}
