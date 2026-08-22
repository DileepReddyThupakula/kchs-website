import "server-only";

import { requireAdmin } from "@/lib/staff/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  AcademicData,
  AcademicSection,
  AcademicYear,
  SchoolClass,
  SectionSubjectAssignment,
  StaffMember,
  Subject,
} from "@/lib/academics/types";

export type {
  AcademicData,
  AcademicSection,
  AcademicYear,
  SchoolClass,
  SectionSubjectAssignment,
  StaffMember,
  Subject,
} from "@/lib/academics/types";

export async function academicData(): Promise<AcademicData> {
  await requireAdmin();
  const supabase = await createClient();
  const [years, classes, sections, subjects, staffMembers, assignments] = await Promise.all([
    supabase.from("academic_years").select("id,label,start_date,end_date,status").order("start_date", { ascending: false }).limit(30),
    supabase.from("school_classes").select("id,name,display_order,active").order("display_order").limit(30),
    supabase.from("academic_sections").select("id,name,active,academic_year_id,class_id,class_teacher_id").order("name").limit(300),
    supabase.from("subjects").select("id,name,code,active,display_order").order("display_order").order("name").limit(300),
    supabase.from("staff_members").select("id,full_name,designation,staff_type,employment_status").order("full_name").limit(300),
    supabase.from("section_subject_assignments").select("id,academic_section_id,subject_id,teacher_id").limit(1000),
  ]);

  const allStaff = (staffMembers.data ?? []) as StaffMember[];
  return {
    years: (years.data ?? []) as AcademicYear[],
    classes: (classes.data ?? []) as SchoolClass[],
    sections: (sections.data ?? []) as AcademicSection[],
    subjects: (subjects.data ?? []) as Subject[],
    staffMembers: allStaff,
    teachers: allStaff.filter((staff) => staff.staff_type === "teacher" && staff.employment_status === "active"),
    assignments: (assignments.data ?? []) as SectionSubjectAssignment[],
  };
}

export async function academicOverview() {
  const data = await academicData();
  const current = data.years.find((year) => year.status === "current") ?? null;
  const sectionsForCurrentYear = current
    ? data.sections.filter((section) => section.academic_year_id === current.id && section.active)
    : [];

  return {
    ...data,
    current,
    metrics: {
      classes: data.classes.filter((schoolClass) => schoolClass.active).length,
      sections: sectionsForCurrentYear.length,
      subjects: data.subjects.filter((subject) => subject.active).length,
    },
  };
}

export async function academicClassDetail(classId: string) {
  const data = await academicData();
  const schoolClass = data.classes.find((item) => item.id === classId) ?? null;
  const current = data.years.find((year) => year.status === "current") ?? null;
  const sections = current
    ? data.sections.filter((section) => section.class_id === classId && section.academic_year_id === current.id)
    : [];
  const sectionIds = new Set(sections.map((section) => section.id));
  const assignments = data.assignments.filter((assignment) => sectionIds.has(assignment.academic_section_id));
  const subjectIds = new Set(assignments.map((assignment) => assignment.subject_id));
  const teacherIds = new Set(sections.map((section) => section.class_teacher_id).filter((id): id is string => Boolean(id)));

  return {
    ...data,
    schoolClass,
    current,
    sections,
    assignments,
    subjects: data.subjects.filter((subject) => subjectIds.has(subject.id)),
    classTeachers: data.staffMembers.filter((staff) => teacherIds.has(staff.id)),
  };
}
