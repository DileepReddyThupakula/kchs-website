import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const url = process.env.LOCAL_DATABASE_URL;

test("concurrent promotions yield one success and one deterministic failure", { skip: !url }, async () => {
  const admin = postgres(url, { max: 1 });
  const userId = randomUUID(), studentId = randomUUID(), sourceId = randomUUID(), sourceYear = randomUUID(), targetYear = randomUUID(), classId = randomUUID(), sourceSection = randomUUID(), targetSection = randomUUID();
  try {
    await admin.begin(async (sql) => {
      await sql`insert into auth.users (id,aud,role) values (${userId},'authenticated','authenticated')`;
      await sql`insert into public.staff_users (user_id,role,active) values (${userId},'admin',true)`;
      await sql`insert into public.academic_years (id,label,start_date,end_date,status) values (${sourceYear},${`Race-${sourceYear.slice(0,6)}`},'2030-06-01','2031-04-30','planning'),(${targetYear},${`Race-${targetYear.slice(0,6)}`},'2031-06-01','2032-04-30','planning')`;
      await sql`insert into public.school_classes (id,name,display_order,active) values (${classId},${`Race Class ${classId.slice(0,6)}`},99,true)`;
      await sql`insert into public.academic_sections (id,academic_year_id,class_id,name,active) values (${sourceSection},${sourceYear},${classId},'Race A',true),(${targetSection},${targetYear},${classId},'Race B',true)`;
      await sql`insert into public.students (id,admission_number,full_name,admission_date,status) values (${studentId},${`RACE-${studentId.slice(0,8)}`},'Synthetic Race Student','2030-06-01','active')`;
      await sql`insert into public.student_enrollments (id,student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date) values (${sourceId},${studentId},${sourceYear},${classId},${sourceSection},'active','2030-06-01')`;
    });

    const run = async () => {
      const sql = postgres(url, { max: 1 });
      try {
        await sql`set role authenticated`;
        await sql.unsafe(`set request.jwt.claim.sub = '${userId}'`);
        await sql.unsafe(`set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'`);
        return await sql`select public.promote_student(${studentId},${sourceId},${targetYear},${classId},${targetSection},'1','2031-06-01')`;
      } finally { await sql.end(); }
    };

    const results = await Promise.allSettled([run(), run()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const active = await admin`select count(*)::int as count from public.student_enrollments where student_id=${studentId} and status='active'`;
    assert.equal(active[0].count, 1);
  } finally {
    await admin`delete from public.student_enrollments where student_id=${studentId}`;
    await admin`delete from public.students where id=${studentId}`;
    await admin`delete from public.academic_sections where id in (${sourceSection},${targetSection})`;
    await admin`delete from public.school_classes where id=${classId}`;
    await admin`delete from public.academic_years where id in (${sourceYear},${targetYear})`;
    await admin`delete from public.staff_users where user_id=${userId}`;
    await admin`delete from auth.users where id=${userId}`;
    await admin.end();
  }
});

test("promotion racing target-class deactivation cannot create invalid active placement", { skip: !url }, async () => {
  const admin = postgres(url, { max: 2 });
  const userId=randomUUID(),studentId=randomUUID(),sourceId=randomUUID(),sourceYear=randomUUID(),targetYear=randomUUID(),sourceClass=randomUUID(),targetClass=randomUUID(),sourceSection=randomUUID(),targetSection=randomUUID();
  try {
    await admin.begin(async(sql)=>{
      await sql`insert into auth.users (id,aud,role) values (${userId},'authenticated','authenticated')`;
      await sql`insert into public.staff_users (user_id,role,active) values (${userId},'admin',true)`;
      await sql`insert into public.academic_years (id,label,start_date,end_date,status) values (${sourceYear},${`Guard-${sourceYear.slice(0,6)}`},'2032-06-01','2033-04-30','planning'),(${targetYear},${`Guard-${targetYear.slice(0,6)}`},'2033-06-01','2034-04-30','planning')`;
      await sql`insert into public.school_classes (id,name,display_order,active) values (${sourceClass},${`Guard Source ${sourceClass.slice(0,6)}`},97,true),(${targetClass},${`Guard Target ${targetClass.slice(0,6)}`},98,true)`;
      await sql`insert into public.academic_sections (id,academic_year_id,class_id,name,active) values (${sourceSection},${sourceYear},${sourceClass},'Guard A',true),(${targetSection},${targetYear},${targetClass},'Guard B',true)`;
      await sql`insert into public.students (id,admission_number,full_name,admission_date,status) values (${studentId},${`GUARD-${studentId.slice(0,8)}`},'Synthetic Guard Student','2032-06-01','active')`;
      await sql`insert into public.student_enrollments (id,student_id,academic_year_id,class_id,academic_section_id,status,enrollment_date) values (${sourceId},${studentId},${sourceYear},${sourceClass},${sourceSection},'active','2032-06-01')`;
    });
    const promote=async()=>{const sql=postgres(url,{max:1});try{await sql`set role authenticated`;await sql.unsafe(`set request.jwt.claim.sub = '${userId}'`);await sql.unsafe(`set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'`);return await sql`select public.promote_student(${studentId},${sourceId},${targetYear},${targetClass},${targetSection},'1','2033-06-01')`;}finally{await sql.end();}};
    const deactivate=async()=>{const sql=postgres(url,{max:1});try{return await sql`update public.school_classes set active=false where id=${targetClass}`;}finally{await sql.end();}};
    const results=await Promise.allSettled([promote(),deactivate()]);
    assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
    assert.equal(results.filter(result=>result.status==="rejected").length,1);
    const invalid=await admin`select count(*)::int as count from public.student_enrollments e join public.school_classes c on c.id=e.class_id where e.student_id=${studentId} and e.status='active' and not c.active`;
    assert.equal(invalid[0].count,0);
  } finally {
    await admin`delete from public.student_enrollments where student_id=${studentId}`;
    await admin`delete from public.students where id=${studentId}`;
    await admin`delete from public.academic_sections where id in (${sourceSection},${targetSection})`;
    await admin`delete from public.school_classes where id in (${sourceClass},${targetClass})`;
    await admin`delete from public.academic_years where id in (${sourceYear},${targetYear})`;
    await admin`delete from public.staff_users where user_id=${userId}`;
    await admin`delete from auth.users where id=${userId}`;
    await admin.end();
  }
});
