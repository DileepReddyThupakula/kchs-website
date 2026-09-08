import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const configuredUrl = process.env.LOCAL_DATABASE_URL;

function isLocalDatabaseUrl(value) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

const url = isLocalDatabaseUrl(configuredUrl) ? configuredUrl : undefined;
const timeoutMs = 15000;
const uuidTypeOid = 2950;

async function asAdmin(sql, userId) {
  await sql`set role authenticated`;
  await sql`select set_config('request.jwt.claim.sub', ${userId}, false)`;
  await sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, false)`;
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function createFixture(studentCount = 1) {
  const admin = postgres(url, { max: 3 });
  try {
    const token = randomUUID().replaceAll("-", "").slice(0, 10);
    const adminIds = [randomUUID(), randomUUID()];
    const sourceYear = randomUUID();
    const targetYear = randomUUID();
    const sourceClass = randomUUID();
    const targetClass = randomUUID();
    const sourceSection = randomUUID();
    const targetSection = randomUUID();
    const studentIds = Array.from({ length: studentCount }, () => randomUUID());
    const sourceEnrollmentIds = studentIds.map(() => randomUUID());
    const previousCurrent = await admin`
      select id
      from public.academic_years
      where status = 'current'
    `;
    assert.ok(previousCurrent.length <= 1, "the one-current-year invariant must hold before the fixture");

    await admin.begin(async (sql) => {
      await sql`update public.academic_years set status = 'planning' where status = 'current'`;
      for (const userId of adminIds) {
        await sql`insert into auth.users (id, aud, role) values (${userId}, 'authenticated', 'authenticated')`;
        await sql`insert into public.staff_users (user_id, role, active) values (${userId}, 'admin', true)`;
      }

      const orders = await sql`
        select candidate::int
        from generate_series(20, 100) as candidate
        where not exists (
          select 1 from public.school_classes where display_order = candidate
        )
        order by candidate
        limit 2
      `;
      assert.equal(orders.length, 2, "fixture requires two available class display orders");

      await sql`
        insert into public.academic_years (id, label, start_date, end_date, status)
        values
          (${sourceYear}, ${`Rsrc-${token}`}, '2050-06-01', '2051-04-30', 'current'),
          (${targetYear}, ${`Rtgt-${token}`}, '2051-06-01', '2052-04-30', 'planning')
      `;
      await sql`
        insert into public.school_classes (id, name, display_order, active)
        values
          (${sourceClass}, ${`Rollover race source ${token}`}, ${orders[0].candidate}, true),
          (${targetClass}, ${`Rollover race target ${token}`}, ${orders[1].candidate}, true)
      `;
      await sql`
        insert into public.academic_sections (id, academic_year_id, class_id, name, active)
        values
          (${sourceSection}, ${sourceYear}, ${sourceClass}, 'Race Source', true),
          (${targetSection}, ${targetYear}, ${targetClass}, 'Race Target', true)
      `;
      for (let index = 0; index < studentIds.length; index += 1) {
        await sql`
          insert into public.students (id, admission_number, full_name, admission_date, status)
          values (${studentIds[index]}, ${`ROLLOVER-RACE-${token}-${index}`}, ${`Rollover Race Student ${index}`}, '2050-06-01', 'active')
        `;
        await sql`
          insert into public.student_enrollments
            (id, student_id, academic_year_id, class_id, academic_section_id, roll_number, status, enrollment_date)
          values
            (${sourceEnrollmentIds[index]}, ${studentIds[index]}, ${sourceYear}, ${sourceClass}, ${sourceSection}, ${String(index + 1)}, 'active', '2050-06-01')
        `;
      }
    });

    return {
      admin,
      adminIds,
      sourceYear,
      targetYear,
      sourceClass,
      targetClass,
      sourceSection,
      targetSection,
      studentIds,
      sourceEnrollmentIds,
      previousCurrentId: previousCurrent[0]?.id ?? null,
    };
  } catch (error) {
    await admin.end().catch(() => {});
    throw error;
  }
}

function planFor(data, rollOffset = 0) {
  return data.studentIds.map((studentId, index) => ({
    student_id: studentId,
    source_enrollment_id: data.sourceEnrollmentIds[index],
    outcome: "promote",
    target_class_id: data.targetClass,
    target_section_id: data.targetSection,
    target_roll_number: String(index + 1 + rollOffset),
    reason: "Concurrency verification",
  }));
}

async function preflight(data, plan) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, data.adminIds[0]);
    const result = await sql`
      select public.preflight_academic_year_rollover(
        ${data.sourceYear}, ${data.targetYear}, ${sql.json(plan)}
      ) as result
    `;
    assert.equal(result.length, 1);
    assert.equal(result[0].result.ready, true, JSON.stringify(result[0].result.errors));
    return result[0].result;
  } finally {
    await sql.end();
  }
}

async function execute(data, userId, plan, fingerprint) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, userId);
    const result = await sql`
      select public.execute_academic_year_rollover(
        ${data.sourceYear}, ${data.targetYear}, ${sql.json(plan)}, ${fingerprint}
      ) as result
    `;
    return result[0].result;
  } finally {
    await sql.end();
  }
}

async function promote(data, userId, index = 0) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, userId);
    return await sql`
      select public.promote_student(
        ${data.studentIds[index]}, ${data.sourceEnrollmentIds[index]},
        ${data.targetYear}, ${data.targetClass}, ${data.targetSection},
        ${String(index + 1)}, '2051-06-01'
      ) as result
    `;
  } finally {
    await sql.end();
  }
}

async function transfer(data, userId, index = 0) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, userId);
    return await sql`
      select public.transfer_student(
        ${data.studentIds[index]}, ${data.sourceEnrollmentIds[index]},
        '2051-05-01', 'Concurrency transfer'
      ) as result
    `;
  } finally {
    await sql.end();
  }
}

async function deactivateStudent(data, userId, index = 0) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, userId);
    return await sql`
      select public.deactivate_student(
        ${data.studentIds[index]}, ${data.sourceEnrollmentIds[index]},
        '2051-05-01', 'Concurrency deactivation'
      ) as result
    `;
  } finally {
    await sql.end();
  }
}

async function deactivateTargetSection(data, userId) {
  const sql = postgres(url, { max: 1 });
  try {
    await asAdmin(sql, userId);
    return await sql`
      update public.academic_sections
      set active = false
      where id = ${data.targetSection}
      returning id
    `;
  } finally {
    await sql.end();
  }
}

async function state(data) {
  const students = await data.admin`
    select id, status::text as status
    from public.students
    where id = any(${data.admin.array(data.studentIds, uuidTypeOid)})
    order by id
  `;
  const enrollments = await data.admin`
    select student_id, academic_year_id, academic_section_id, roll_number, status::text as status
    from public.student_enrollments
    where student_id = any(${data.admin.array(data.studentIds, uuidTypeOid)})
    order by student_id, enrollment_date, id
  `;
  const years = await data.admin`
    select id, status::text as status
    from public.academic_years
    where id in (${data.sourceYear}, ${data.targetYear})
  `;
  const operations = await data.admin`
    select id, status::text as status, plan_fingerprint
    from public.academic_year_rollover_operations
    where source_academic_year_id = ${data.sourceYear}
      and target_academic_year_id = ${data.targetYear}
  `;
  const targetSection = await data.admin`
    select active
    from public.academic_sections
    where id = ${data.targetSection}
  `;
  const currentYears = await data.admin`
    select count(*)::int as count
    from public.academic_years
    where status = 'current'
  `;
  const activeStudentMismatches = await data.admin`
    select count(*)::int as count
    from public.student_enrollments e
    join public.students s on s.id = e.student_id
    where e.status = 'active' and s.status <> 'active'
  `;
  const invalidActivePlacements = await data.admin`
    select count(*)::int as count
    from public.student_enrollments e
    join public.academic_years y on y.id = e.academic_year_id
    join public.school_classes c on c.id = e.class_id
    join public.academic_sections sec on sec.id = e.academic_section_id
    where e.status = 'active'
      and (y.status = 'closed' or not c.active or not sec.active
        or sec.academic_year_id <> e.academic_year_id
        or sec.class_id <> e.class_id)
  `;
  const duplicateRolls = await data.admin`
    select count(*)::int as count
    from (
      select academic_section_id, lower(btrim(roll_number))
      from public.student_enrollments
      where roll_number is not null
      group by academic_section_id, lower(btrim(roll_number))
      having count(*) > 1
    ) duplicates
  `;
  return {
    students,
    enrollments,
    years,
    operations,
    targetSection: targetSection[0]?.active,
    currentYearCount: currentYears[0].count,
    activeStudentMismatches: activeStudentMismatches[0].count,
    invalidActivePlacements: invalidActivePlacements[0].count,
    duplicateRolls: duplicateRolls[0].count,
  };
}

function assertGlobalInvariants(result) {
  assert.equal(result.currentYearCount, 1);
  assert.equal(result.activeStudentMismatches, 0);
  assert.equal(result.invalidActivePlacements, 0);
  assert.equal(result.duplicateRolls, 0);
}

function assertSuccessfulRollover(result, data) {
  assertGlobalInvariants(result);
  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].status, "completed");
  assert.equal(result.years.find((year) => year.id === data.sourceYear)?.status, "closed");
  assert.equal(result.years.find((year) => year.id === data.targetYear)?.status, "current");
  assert.equal(result.enrollments.filter((row) => row.academic_year_id === data.sourceYear && row.status === "active").length, 0);
  assert.equal(result.enrollments.filter((row) => row.academic_year_id === data.targetYear && row.status === "active").length, data.studentIds.length);
}

function assertLifecycleWinner(result, data, expectedStatus) {
  assertGlobalInvariants(result);
  assert.equal(result.operations.length, 0);
  assert.equal(result.years.find((year) => year.id === data.sourceYear)?.status, "current");
  assert.equal(result.years.find((year) => year.id === data.targetYear)?.status, "planning");
  assert.equal(result.students[0].status, expectedStatus);
}

async function cleanup(data) {
  try {
    const rolloverRecords = await data.admin`
      select 1
      from public.academic_year_rollover_operations
      where source_academic_year_id = ${data.sourceYear}
        and target_academic_year_id = ${data.targetYear}
      limit 1
    `;
    if (rolloverRecords.length > 0) return;

    await data.admin.begin(async (sql) => {
      await sql`update public.academic_years set status = 'planning' where id in (${data.sourceYear}, ${data.targetYear})`;
      await sql`delete from public.student_enrollments where student_id = any(${sql.array(data.studentIds, uuidTypeOid)})`;
      await sql`delete from public.students where id = any(${sql.array(data.studentIds, uuidTypeOid)})`;
      await sql`delete from public.academic_sections where id in (${data.sourceSection}, ${data.targetSection})`;
      await sql`delete from public.school_classes where id in (${data.sourceClass}, ${data.targetClass})`;
      await sql`delete from public.academic_years where id in (${data.sourceYear}, ${data.targetYear})`;
      await sql`delete from public.staff_users where user_id in (${data.adminIds[0]}, ${data.adminIds[1]})`;
      await sql`delete from auth.users where id in (${data.adminIds[0]}, ${data.adminIds[1]})`;
      if (data.previousCurrentId) {
        await sql`update public.academic_years set status = 'current' where id = ${data.previousCurrentId}`;
      }
    });
  } finally {
    await data.admin.end();
  }
}

async function runWithCleanup(data, scenario) {
  let scenarioError;
  try {
    return await scenario();
  } catch (error) {
    scenarioError = error;
    throw error;
  } finally {
    try {
      await cleanup(data);
    } catch (cleanupError) {
      if (scenarioError) {
        console.error("Concurrency cleanup failed after the scenario already failed:", cleanupError);
      } else {
        throw cleanupError;
      }
    }
  }
}

test("identical concurrent rollover execution is idempotent", { skip: !url }, async () => {
  const data = await createFixture(2);
  await runWithCleanup(data, async () => {
    const plan = planFor(data);
    const preview = await preflight(data, plan);
    const results = await withTimeout(
      Promise.allSettled([
        execute(data, data.adminIds[0], plan, preview.fingerprint),
        execute(data, data.adminIds[1], plan, preview.fingerprint),
      ]),
      "identical rollover execution",
    );
    const finalState = await state(data);
    assertSuccessfulRollover(finalState, data);
    assert.equal(finalState.operations.length, 1);
    assert.equal(finalState.enrollments.length, data.studentIds.length * 2);
    assert.ok(results.some((result) => result.status === "fulfilled"));
  });
});

test("rollover racing single-student promotion leaves one valid serializable outcome", { skip: !url }, async () => {
  const data = await createFixture();
  await runWithCleanup(data, async () => {
    const plan = planFor(data);
    const preview = await preflight(data, plan);
    await withTimeout(
      Promise.allSettled([
        execute(data, data.adminIds[0], plan, preview.fingerprint),
        promote(data, data.adminIds[1]),
      ]),
      "rollover versus promotion",
    );
    const finalState = await state(data);
    assertGlobalInvariants(finalState);
    assert.equal(finalState.students[0].status, "active");
    assert.equal(finalState.enrollments.filter((row) => row.status === "active").length, 1);
    assert.equal(finalState.enrollments.length, 2);
    assert.ok(finalState.operations.length === 0 || finalState.operations[0].status === "completed");
    if (finalState.operations.length === 1) assertSuccessfulRollover(finalState, data);
    else {
      assert.equal(finalState.enrollments.find((row) => row.academic_year_id === data.sourceYear)?.status, "completed");
      assert.equal(finalState.years.find((year) => year.id === data.sourceYear)?.status, "current");
      assert.equal(finalState.years.find((year) => year.id === data.targetYear)?.status, "planning");
    }
  });
});

test("rollover racing transfer leaves one valid serializable outcome", { skip: !url }, async () => {
  const data = await createFixture();
  await runWithCleanup(data, async () => {
    const plan = planFor(data);
    const preview = await preflight(data, plan);
    await withTimeout(
      Promise.allSettled([
        execute(data, data.adminIds[0], plan, preview.fingerprint),
        transfer(data, data.adminIds[1]),
      ]),
      "rollover versus transfer",
    );
    const finalState = await state(data);
    assertGlobalInvariants(finalState);
    assert.equal(finalState.enrollments.length, finalState.operations.length === 1 ? 2 : 1);
    if (finalState.operations.length === 1) {
      assertSuccessfulRollover(finalState, data);
      assert.equal(finalState.students[0].status, "active");
    } else {
      assertLifecycleWinner(finalState, data, "transferred");
      assert.equal(finalState.enrollments[0].status, "transferred");
    }
  });
});

test("rollover racing deactivation leaves one valid serializable outcome", { skip: !url }, async () => {
  const data = await createFixture();
  await runWithCleanup(data, async () => {
    const plan = planFor(data);
    const preview = await preflight(data, plan);
    await withTimeout(
      Promise.allSettled([
        execute(data, data.adminIds[0], plan, preview.fingerprint),
        deactivateStudent(data, data.adminIds[1]),
      ]),
      "rollover versus deactivation",
    );
    const finalState = await state(data);
    assertGlobalInvariants(finalState);
    assert.equal(finalState.enrollments.length, finalState.operations.length === 1 ? 2 : 1);
    if (finalState.operations.length === 1) {
      assertSuccessfulRollover(finalState, data);
      assert.equal(finalState.students[0].status, "active");
    } else {
      assertLifecycleWinner(finalState, data, "inactive");
      assert.equal(finalState.enrollments[0].status, "inactive");
    }
  });
});

test("rollover racing target-section deactivation cannot commit an invalid placement", { skip: !url }, async () => {
  const data = await createFixture();
  await runWithCleanup(data, async () => {
    const plan = planFor(data);
    const preview = await preflight(data, plan);
    await withTimeout(
      Promise.allSettled([
        execute(data, data.adminIds[0], plan, preview.fingerprint),
        deactivateTargetSection(data, data.adminIds[1]),
      ]),
      "rollover versus target-section deactivation",
    );
    const finalState = await state(data);
    assertGlobalInvariants(finalState);
    assert.equal(finalState.enrollments.length, finalState.operations.length === 1 ? 2 : 1);
    if (finalState.operations.length === 1) {
      assertSuccessfulRollover(finalState, data);
      assert.equal(finalState.targetSection, true);
    } else {
      assert.equal(finalState.targetSection, false);
      assert.equal(finalState.years.find((year) => year.id === data.sourceYear)?.status, "current");
      assert.equal(finalState.enrollments[0].status, "active");
    }
  });
});

test("competing rollovers to one target year commit at most one operation", { skip: !url }, async () => {
  const data = await createFixture(2);
  await runWithCleanup(data, async () => {
    const firstPlan = planFor(data, 0);
    const secondPlan = planFor(data, 10);
    const [firstPreview, secondPreview] = await Promise.all([preflight(data, firstPlan), preflight(data, secondPlan)]);
    assert.notEqual(firstPreview.fingerprint, secondPreview.fingerprint);
    await withTimeout(
      Promise.allSettled([
        execute(data, data.adminIds[0], firstPlan, firstPreview.fingerprint),
        execute(data, data.adminIds[1], secondPlan, secondPreview.fingerprint),
      ]),
      "competing rollovers",
    );
    const finalState = await state(data);
    assertSuccessfulRollover(finalState, data);
    assert.equal(finalState.operations.length, 1);
    assert.equal(finalState.enrollments.filter((row) => row.academic_year_id === data.targetYear && row.status === "active").length, 2);
  });
});
