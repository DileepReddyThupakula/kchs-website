import Link from "next/link";

import { StaffEventForm } from "@/components/staff-event-form";

export default async function NewStaffEventPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) { const feedback = await searchParams; return <><Link className="staff-back" href="/staff/events">← Back to event management</Link><header className="staff-page-header staff-event-editor-header"><div><p className="eyebrow">School calendar</p><h1>Create event</h1><p>Prepare an event as a draft or publish it to the school calendar.</p></div></header>{feedback.error && <p className="staff-feedback" role="status">We could not save this event. Please review the dates and required fields.</p>}<StaffEventForm /></>; }
