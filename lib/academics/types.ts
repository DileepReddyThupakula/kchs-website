export type AcademicYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: "planning" | "current" | "closed";
};

export type SchoolClass = {
  id: string;
  name: string;
  display_order: number;
  active: boolean;
};

export type AcademicSection = {
  id: string;
  name: string;
  active: boolean;
  academic_year_id: string;
  class_id: string;
  class_teacher_id: string | null;
};

export type Subject = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  display_order: number;
};

export type StaffMember = {
  id: string;
  full_name: string;
  designation: string | null;
  staff_type: string;
  employment_status: string;
};

export type SectionSubjectAssignment = {
  id: string;
  academic_section_id: string;
  subject_id: string;
  teacher_id: string | null;
};

export type AcademicData = {
  years: AcademicYear[];
  classes: SchoolClass[];
  sections: AcademicSection[];
  subjects: Subject[];
  staffMembers: StaffMember[];
  teachers: StaffMember[];
  assignments: SectionSubjectAssignment[];
};
