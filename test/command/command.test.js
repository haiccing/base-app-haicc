// The package's own test: its program, the haicc command line, run as a
// process on a home folder made here (README.md beside it). A folder stands
// in for the root mrepo: its inbox is answered here. No runtime is started.
import test from '../../modules/node_modules/brittle/index.js'
import { mkdtempSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync } from '../../modules/node_modules/bare-fs/index.js'
import os from '../../modules/node_modules/bare-os/index.js'
import { join, dirname } from '../../modules/node_modules/bare-path/index.js'
import { fileURLToPath } from '../../modules/node_modules/bare-url/index.js'
import { spawn } from '../../modules/node_modules/bare-subprocess/index.js'
import { CONFIG, USAGE } from '../../modules/pear-full-square/haicc-base-app/index.js'
import { inboxOf, outboxOf, nameOf } from '../../modules/pear-full-square/mrepo-base-request/index.js'

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const home = mkdtempSync(join(os.tmpdir(), 'app-haicc-'))
const work = join(home, 'work')
const root = join(work, 'mrepos', CONFIG.root.name)

// The command line run through the package's dispatcher, as the platform's
// haicc starts it: bare <package> /run <argument>...; what it printed, what
// it said on stderr, its exit code. via: the program instead (run.js).
function haicc (args, { env = {}, via = ['main.js', '/run'] } = {}) {
  const all = { ...Object.fromEntries(os.getEnvKeys().filter(k => !k.startsWith('HAICC_')).map(k => [k, os.getEnv(k)])), HAICC_HOME: home, ...env }
  return new Promise(resolve => {
    const child = spawn(os.execPath(), [join(pkg, via[0]), ...via.slice(1), ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: all })
    let out = ''
    let err = ''
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('exit', code => resolve({ code, out, err }))
  })
}
// The next record in the root's inbox answered in its outbox, as its
// runtime would: the record it read, its request returned with what is
// said ({ status, message }; null: not returned).
function answer (said) {
  // (what arrives after the last one there: a pointer; both boxes streaming folders)
  const last = inboxOf(root).list({ limit: 1 })[0] ?? null
  return new Promise(resolve => {
    const t = setInterval(() => {
      const [offset] = inboxOf(root).list({ after: last, ascending: true, limit: 1 })
      if (offset === undefined) return
      clearInterval(t)
      const record = inboxOf(root).read(offset)
      outboxOf(root).put(offset, { topic: '/outbox', key: null, offset, timestamp: '2026-11-14T00:00:00.000Z', headers: {}, value: said === null ? record.value : { ...record.value, returned: { status: said.status ?? 'done', message: said.message, attachments: [] } } })
      const text = readFileSync(outboxOf(root).fileOf(offset), 'utf8')
      resolve({ file: nameOf(offset), record, text })
    }, 20)
  })
}
const ran = new Set()
const asked = (kind, r) => { ran.add(kind); return r }

test('the usage: every form of the command line, printed; exit 0', async (t) => {
  for (const a of [['--help'], ['help'], ['-h'], []]) {
    const r = asked('usage', await haicc(a))
    t.alike([r.code, r.out, r.err], [0, USAGE + '\n', ''], `haicc ${a.join(' ')}`)
  }
  for (const form of ['haicc <URI> <protocol>/<action> <argument>...', 'haicc --raw <URI>', 'haicc --request <URI>', 'haicc boot/deploy', 'haicc boot/teardown', 'haicc sources', 'haicc sources unlink <folder>', 'haicc sources download <org>...', 'haicc sources https | no-https [<org>...]']) t.ok(USAGE.includes(form), `in it: ${form}`)
})

test('not a command: exit 2, said on stderr, nothing printed', async (t) => {
  for (const [a, said] of [
    [['nosuch'], "haicc: no command 'nosuch' (haicc --help; a URI is followed by its command: haicc nosuch info/get)"],
    [['.'], 'haicc: haicc <URI> <protocol>/<action> <argument>... (a command follows the URI)'],
    [['swarms/swarm-1'], 'haicc: haicc <URI> <protocol>/<action> <argument>... (a command follows the URI)'],
    [['host'], "haicc: no command 'host' (haicc --help; a URI is followed by its command: haicc host info/get)"],
    [['boot'], 'haicc: haicc boot/deploy, haicc boot/teardown'],
    [['boot/nosuch'], 'haicc: no action: boot nosuch (deploy, teardown)'],
    [['boot/deploy', 'host'], 'haicc: haicc boot/deploy (no arguments)'],
    [['--request'], 'haicc: --request goes before a URI'],
    [['--raw'], 'haicc: --raw goes before a URI'],
    [['sources', 'link', '/x'], 'haicc: haicc sources [unlink <folder> | download <org>... | https [<org>...] | no-https [<org>...]]']
  ]) {
    const r = await haicc(a)
    t.alike([r.code, r.out, r.err], [2, '', said + '\n'], `haicc ${a.join(' ')}`)
  }
})

test('nothing booted: said, exit 3 (the teardown a repeat, a warning, exit 0), nothing written', async (t) => {
  let r = asked('request', await haicc(['host', 'service/start']))
  t.alike([r.code, r.out, r.err], [3, '', `haicc: no boot mrepo at ${work} (haicc boot/deploy)\n`], 'a command for the mrepos')
  r = asked('boot/teardown', await haicc(['boot/teardown']))
  t.alike([r.code, r.out, r.err], [0, `Nothing to tear down at ${work}: no boot mrepo there.\n`, `haicc: warning: no boot mrepo at ${work}: nothing to tear down\n`], 'haicc boot/teardown: idempotent, a repeat, its warning on stderr')
  r = asked('boot/deploy', await haicc(['boot/deploy']))
  t.alike([r.code, r.out, r.err], [3, '', `haicc: no ${CONFIG.org}/${CONFIG.boot}.bundle in the sources (haicc sources link <folder>)\n`], 'haicc boot/deploy, no source holding the boot component')
  r = await haicc(['.', 'info/get'], { env: { HAICC_WORK: join(home, 'elsewhere') } })
  t.alike([r.code, r.err], [3, `haicc: no boot mrepo at ${join(home, 'elsewhere')} (haicc boot/deploy)\n`], 'HAICC_WORK: another work folder')
  t.alike(readdirSync(home), [], 'nothing written')
})

test('haicc sources: the list in its own folder, read and changed', async (t) => {
  mkdirSync(join(home, 'src'))
  writeFileSync(join(home, 'sources.list'), `github:${CONFIG.org}\nfolder:${join(home, 'src')}\n`)
  let r = asked('sources', await haicc(['sources']))
  t.alike([r.code, r.out], [0, `folder:${join(home, 'src')}\ngithub:${CONFIG.org}\n`], 'haicc sources: the folders first, https after')
  r = await haicc(['sources', 'no-https'])
  t.alike([r.code, r.out], [0, `folder:${join(home, 'src')}\n`], 'no-https: the backup off')
  r = await haicc(['sources', 'https'])
  t.alike([r.code, r.out], [0, `folder:${join(home, 'src')}\ngithub:${CONFIG.org}\n`], 'https: back on')
  r = await haicc(['sources', 'download', CONFIG.org])
  t.alike([r.code, r.out, r.err], [3, '', `haicc: ${CONFIG.org}: fetched before the app (haicc sources download ${CONFIG.org})\n`], 'download: an organisation, the first step\'s, not the app\'s: exit 3')
  r = await haicc(['sources', 'unlink', join(home, 'src')])
  t.alike([r.code, r.out], [0, `github:${CONFIG.org}\n`], 'unlink')
  t.is(readFileSync(join(home, 'sources.list'), 'utf8'), `github:${CONFIG.org}\n`, 'the list written')
})

test('a command for the mrepos: its record in the root\'s inbox, value by value', async (t) => {
  mkdirSync(join(root, 'inbox'), { recursive: true }); mkdirSync(join(root, 'outbox'))
  let a = answer({ message: 'Deployed host.' })
  let r = asked('request', await haicc(['.', 'boot/deploy', 'host', 'haiccing/base-component-haicc']))
  let { file, record } = await a
  t.is(r.code, 0, r.err)
  t.is(record.topic, `/${CONFIG.root.uri}/inbox`, 'a record addressed to the root mrepo\'s inbox: /local/boot/inbox')
  t.is(file, nameOf(record.offset), 'named by its offset')
  t.ok(/^\d{13}$/.test(file) && Math.abs(record.offset - Date.now()) < 60000, 'the offset: the milliseconds when it arrived')
  t.alike([record.key, record.headers], [null, {}], 'no key, its headers empty')
  t.alike([record.value.command, record.value.from, record.value.to, record.value.reply, record.value.form, record.value.returned], ['boot/deploy host haiccing/base-component-haicc', 'terminal', CONFIG.root.uri, '/haicc/terminal', null, null], 'its value a request: at the root the command plain, its line as typed; who asks, the mrepo it is for, its answer back to the terminal')

  a = answer({ message: 'Done.' })
  r = await haicc(['host', 'haicc', 'node-1', 'info/get', '.', 'packages', 'no "such" section'])
  ;({ record } = await a)
  t.is(record.value.command, 'haicc host haicc node-1 info/get . packages "no \\"such\\" section"', 'anywhere else the haicc command as it is: chained, an argument with spaces and quotes one word of its line')

  a = answer({ message: 'Done.' })
  r = await haicc(['/run', 'service/start'])
  ;({ record } = await a)
  t.is(record.value.command, 'haicc /run service/start', 'a first word /run after the entry\'s name: passed on as typed, not taken for the entry')
  a = answer({ message: 'Done.' })
  r = await haicc(['/run', 'service/start'], { via: ['run.js'] })
  ;({ record } = await a)
  t.is(record.value.command, 'haicc /run service/start', 'the same from the program itself (bare run.js)')
})

test('what is returned: what it says printed; the whole request, or its record as stored, by a flag; the exit code from its status', async (t) => {
  const said = { message: 'Deployed host as local/host.\nIts runtime is running, pid 4242.' }
  // (packed again: what the unpacking added taken off; the exact check, strings minded, is the module's)
  const packed = s => JSON.stringify(JSON.parse(s))
  let a = answer(said)
  let r = await haicc(['.', 'boot/deploy', 'host', 'haiccing/base-component-haicc'])
  let { text } = await a
  t.alike([r.code, r.out, r.err], [0, `${said.message}\n`, ''], 'returned done: exit 0; what it says, as it is, nothing else')

  a = answer({ message: 'Done.' })
  r = await haicc(['--request', '.', 'boot/deploy', 'host', 'haiccing/base-component-haicc'])
  ;({ text } = await a)
  t.ok(r.out.trimEnd().split('\n').length > 3 && r.out.trimEnd().split('\n').every(l => l.length <= 80), '--request: the whole request, its record unpacked across lines, to 80 columns: the output is no terminal, no width set')
  t.is(packed(r.out), text.trim(), 'packed again: the record as stored, nothing of it changed')

  a = answer({ message: 'Done.' })
  r = asked('output', await haicc(['output', '1000']))
  t.alike([r.code, r.out], [0, '1000 (set: haicc output auto for the terminal\'s width)\n'], 'haicc output 1000: the width set, kept in haicc\'s own folder')
  r = await haicc(['.', 'info/get'], { env: { HAICC_REQUEST: '1' } })
  ;({ text } = await a)
  t.is(r.out, text, 'HAICC_REQUEST=1, a record that fits the width set: left on one line')
  r = await haicc(['output', 'auto'])
  t.alike([r.code, r.out], [0, 'auto: 80 (the output is no terminal)\n'], 'haicc output auto: back to the default')

  for (const [args, env] of [[['--raw', '.', 'info/get'], {}], [['.', 'info/get'], { HAICC_RAW: '1' }]]) {
    a = answer(said)
    r = await haicc(args, { env })
    ;({ text } = await a)
    t.alike([r.code, r.out], [0, text], `${args[0] === '--raw' ? '--raw' : 'HAICC_RAW=1'}: the record as stored, one line`)
  }

  a = answer({ status: 'failed', message: 'Refused, nothing run.\ndeployed already: host' })
  r = await haicc(['.', 'boot/deploy', 'host', 'x']); await a
  t.alike([r.code, r.out, r.err], [1, '', 'haicc: Refused, nothing run.\ndeployed already: host\n'], 'returned failed: exit 1, what it says on stderr, nothing on stdout')

  a = answer(null)
  r = await haicc(['.', 'info/get']); await a
  t.alike([r.code, r.out, r.err], [5, '', 'haicc: the response holds no request returned\n'], 'a response whose request is not returned: exit 5')

  r = await haicc(['.', 'info/get'], { env: { HAICC_TIMEOUT: '0.5' } })
  t.is(r.code, 4, 'HAICC_TIMEOUT: no response in time, exit 4')
  t.ok(/^haicc: no response in 0\.5 s \(the request stays: \d{13}\)\n$/.test(r.err), 'said, with the request\'s offset')
})

test('boot/teardown: what boot/deploy put in place removed by name, the packages\' scripts too, the rest kept; twice: a repeat', async (t) => {
  for (const d of ['mrepos/boot/.git', 'mrepos/local/host/.git', 'packages/haiccing', 'kept']) mkdirSync(join(work, d), { recursive: true })
  writeFileSync(join(work, 'mrepo.json'), '{}')
  mkdirSync(join(work, 'scripts', 'haiccing', 'base-component-haicc'), { recursive: true })
  writeFileSync(join(work, 'scripts', 'haiccing', 'base-component-haicc', 'cluster.haicc'), 'crud/read .\n')
  writeFileSync(join(work, 'scripts', 'mine.haicc'), 'crud/read .\n')
  let r = asked('boot/teardown', await haicc(['boot/teardown']))
  t.alike([r.code, r.out, r.err], [0, `Torn down the install at ${work}: 0 runtimes stopped, 0 containers removed; its mrepos, its package store and its packages' scripts removed, yours kept.\n`, ''], 'said: the install torn down, no runtime was running')
  t.alike(readdirSync(work).sort(), ['kept', 'scripts'], 'the mrepos, the package store and the setting removed; nothing else')
  t.alike(readdirSync(join(work, 'scripts')), ['mine.haicc'], 'the packages\' scripts removed, the user\'s kept')
  t.ok(existsSync(join(home, 'sources.list')), 'the sources list kept')
  r = await haicc(['boot/teardown'])
  t.alike([r.code, r.out], [0, `Nothing to tear down at ${work}: no boot mrepo there.\n`], 'twice: a repeat, exit 0')
})

test('every kind of command line was run here', (t) => {
  t.alike([...ran].sort(), ['boot/deploy', 'boot/teardown', 'output', 'request', 'sources', 'usage'], 'the usage, the sources, the output\'s width, a command for the mrepos, and each machine level action')
  rmSync(home, { recursive: true, force: true })
  t.absent(existsSync(home), 'the home folder made for the tests removed')
})
