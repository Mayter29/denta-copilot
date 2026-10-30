import assert from 'node:assert/strict';

export async function checkConcurrency(sql, requireSuccess) {
  const actorA = '00000000-0000-4000-8000-000000000001';
  const actorB = '00000000-0000-4000-8000-000000000005';
  const actorNorth = '00000000-0000-4000-8000-000000000004';
  const central = '20000000-0000-4000-8000-000000000001';
  const north = '20000000-0000-4000-8000-000000000003';
  const slot = "(date_trunc('week',clock_timestamp()) + interval '14 days 15 hours')";
  async function prepare(actor, branch, hours) {
    const output = requireSuccess(
      await sql(
        `set role service_role; select public.test_prepare_booking('${actor}','${branch}',${slot}+interval '${hours} hours');`,
      ),
      'prepare race',
    );
    const id = output.split(/\r?\n/).at(-1);
    assert.match(id, /^[a-f0-9-]{36}$/);
    return id;
  }
  function decide(actor, proposal) {
    return `select 'RECEIPT:' || public.dc_decide_demo_proposal('${actor}','${proposal}',true)::text;`;
  }
  function receipt(result) {
    const line = result.stdout.split(/\r?\n/).find((value) => value.startsWith('RECEIPT:'));
    assert.ok(line, 'successful call returned a receipt');
    return JSON.parse(line.slice('RECEIPT:'.length));
  }
  async function race(actor1, p1, actor2, p2) {
    let signalReady;
    const ready = new Promise((resolve) => {
      signalReady = resolve;
    });
    // Keep the first effect uncommitted. The second connection MUST contend with it.
    const first = sql(
      `begin; set local role service_role; set local statement_timeout='5s';
      ${decide(actor1, p1)} select 'DENTA_DB_HOLD'; select pg_sleep(1.2); commit;`,
      (output) => {
        if (output.includes('DENTA_DB_HOLD')) signalReady();
      },
    );
    await Promise.race([
      ready,
      first.then((result) => {
        requireSuccess(result, 'first concurrent call');
        throw new Error('First transaction ended before the concurrency barrier');
      }),
    ]);
    const second = sql(`set role service_role; set statement_timeout='5s'; ${decide(actor2, p2)}`);
    return Promise.all([first, second]);
  }

  const p = await prepare(actorA, central, 0);
  const duplicate = await race(actorA, p, actorA, p);
  duplicate.forEach((result) => requireSuccess(result, 'duplicate confirmation'));
  assert.deepEqual(receipt(duplicate[0]), receipt(duplicate[1]));
  console.log('concurrent_double_click_ok');

  const p1 = await prepare(actorA, central, 1);
  const p2 = await prepare(actorB, central, 1);
  const sameSite = await race(actorA, p1, actorB, p2);
  requireSuccess(sameSite[0], 'same-site winner');
  assert.equal(sameSite[1].code, 3);
  assert.match(sameSite[1].stderr, /23P01/);
  console.log('concurrent_same_site_conflict_ok');

  const p3 = await prepare(actorA, central, 2);
  const p4 = await prepare(actorNorth, north, 2);
  const crossSite = await race(actorA, p3, actorNorth, p4);
  requireSuccess(crossSite[0], 'cross-site winner');
  assert.equal(crossSite[1].code, 3);
  assert.match(crossSite[1].stderr, /23P01/);
  assert.match(crossSite[1].stderr, /exclusion constraint/); // Database backstop, not only the pre-check.
  console.log('concurrent_cross_site_exclusion_ok');

  const summary = requireSuccess(
    await sql(`select jsonb_build_object(
    'appointments',(select count(*) from public.dc_demo_appointments),
    'receipts',(select count(*) from public.dc_receipts),
    'decisions',(select count(*) from public.dc_decisions));`),
    'concurrency summary',
  );
  assert.deepEqual(JSON.parse(summary), { appointments: 3, receipts: 3, decisions: 3 });
}
