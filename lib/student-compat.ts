export type StudentAddressSource = {
  door_number: string | null;
  street: string | null;
  address_line_2: string | null;
  area_locality: string | null;
  village_town_city: string | null;
  mandal: string | null;
  district: string | null;
  state: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  locality: string | null;
  city: string | null;
};

export type StudentContactSource = {
  primary_contact: "father" | "mother" | "guardian" | null;
  father_name: string | null;
  father_mobile: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_mobile: string | null;
  mother_email: string | null;
  guardian_name: string | null;
  guardian_mobile: string | null;
  guardian_email: string | null;
  father_guardian_name: string | null;
  primary_phone: string | null;
  email: string | null;
};

const join = (parts: Array<string | null>) => parts.filter((value): value is string => Boolean(value)).join(", ");

export function formatStudentAddress(student: StudentAddressSource) {
  const structuredOnly = [student.door_number, student.street, student.area_locality, student.village_town_city, student.mandal, student.district];
  const structured = [student.door_number, student.street, student.address_line_2, student.area_locality, student.village_town_city, student.mandal, student.district, student.state, student.postal_code];
  const structuredComplete = Boolean(student.door_number && student.street && (student.area_locality || student.village_town_city || student.mandal || student.district));
  if (structuredComplete) return join(structured);
  if (structuredOnly.some(Boolean)) return join([
    student.door_number,
    student.street,
    student.address_line_1,
    student.address_line_2,
    student.area_locality ?? student.locality,
    student.village_town_city ?? student.city,
    student.mandal,
    student.district,
    student.state,
    student.postal_code,
  ]);
  return join([student.address_line_1, student.address_line_2, student.locality, student.city, student.state, student.postal_code]);
}

export function studentContactSummary(student: StudentContactSource) {
  const contacts = {
    father: { name: student.father_name, phone: student.father_mobile, email: student.father_email },
    mother: { name: student.mother_name, phone: student.mother_mobile, email: student.mother_email },
    guardian: { name: student.guardian_name, phone: student.guardian_mobile, email: student.guardian_email },
  };
  const preferred = student.primary_contact ? contacts[student.primary_contact] : null;
  const upgraded = preferred && Object.values(preferred).some(Boolean)
    ? preferred
    : [contacts.guardian, contacts.father, contacts.mother].find((contact) => Object.values(contact).some(Boolean));
  const legacy = { name: student.father_guardian_name, phone: student.primary_phone, email: student.email };
  return upgraded ? { name: upgraded.name ?? legacy.name, phone: upgraded.phone ?? legacy.phone, email: upgraded.email ?? legacy.email } : legacy;
}
