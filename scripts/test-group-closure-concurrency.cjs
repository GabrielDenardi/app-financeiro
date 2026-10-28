const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

// Optional Docker integration: independent PostgreSQL sessions, no host ports or volumes.
module.exports = async function testConcurrency(setup, { admin, member, group }) {
  const container = `nitin-group-closure-${process.pid}`;
  const run = (args, input = '') => new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `docker exited ${code}`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
  const sql = text => run(['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], text);
  const login = `select set_config('request.jwt.claim.sub', '${admin}', false);`;
  const waitSleeping = async application => {
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await sql(`select count(*) from pg_stat_activity where application_name = '${application}' and wait_event = 'PgSleep';`)).trim() === '1') return;
      await delay(100);
    }
    throw new Error(`Session ${application} did not reach its lock-holding phase`);
  };
  await run(['run', '--rm', '-d', '--network', 'none', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await run(['exec', container, 'pg_isready', '-U', 'postgres']); ready = true; break; } catch { await delay(200); }
    }
    assert.ok(ready, 'isolated PostgreSQL became ready');
    await sql(setup);
    const insert = `insert into group_splits(id,group_id,created_by,owner_user_id,title,kind,split_mode,total_amount)
      values('00000000-0000-0000-0000-000000000099','${group}','${admin}','${admin}','Concorrência','expense','equal',100);`;

    // Close wins: a new expense waits and must be rejected after the commit.
    const closing = sql(`${login} set application_name = 'closure_wins'; begin;
      select close_group('${group}'); select pg_sleep(2); commit;`);
    await waitSleeping('closure_wins');
    const blockedInsert = assert.rejects(sql(`${login} ${insert}`), /grupo foi encerrado/);
    await Promise.all([closing, blockedInsert]);
    assert.equal((await sql('select count(*) from group_splits;')).trim(), '0');

    // Movement wins: closure waits and must see the debt committed by the writer.
    await sql(`${login} select reopen_group('${group}');`);
    const writing = sql(`${login} set application_name = 'movement_wins'; begin; ${insert}
      insert into group_split_shares(split_id,user_id,share_amount)
      values('00000000-0000-0000-0000-000000000099','${member}',50);
      select pg_sleep(2); commit;`);
    await waitSleeping('movement_wins');
    const blockedClose = assert.rejects(sql(`${login} select close_group('${group}');`), /saldos em aberto/);
    await Promise.all([writing, blockedClose]);
    assert.equal((await sql(`select status from groups where id = '${group}';`)).trim(), 'active');
    console.log('PostgreSQL concurrency checks passed: close-before-movement and movement-before-close.');
  } finally {
    await run(['stop', container]);
  }
};
