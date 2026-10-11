import { useCallback, useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { monad, GOV, govAbi } from './chain'

const pc = createPublicClient({ chain: monad, transport: http(undefined, { batch: true, retryCount: 4, retryDelay: 1000 }) })
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`
const read = (functionName, args = []) => pc.readContract({ address: GOV, abi: govAbi, functionName, args })
const reason = (e) => (e?.shortMessage || e?.message || 'Something went wrong').split('reason:').pop().trim().split('\n')[0]
const left = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(m, 1)}m` }
const DURATIONS = [['1 hour', 3600], ['1 day', 86400], ['7 days', 604800], ['30 days', 2592000]]

async function load(user) {
  const n = Number(await read('proposalCount'))
  const ids = Array.from({ length: Math.min(n, 20) }, (_, i) => n - 1 - i)
  return Promise.all(ids.map(async (id) => {
    const [p, voted] = await Promise.all([read('getProposal', [BigInt(id)]), user ? read('hasVoted', [BigInt(id), user]) : false])
    return { id, ...p, forVotes: Number(p.forVotes), againstVotes: Number(p.againstVotes), abstainVotes: Number(p.abstainVotes), voted }
  }))
}

const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0)
const CH = [['For', 'for'], ['Against', 'against'], ['Abstain', 'abstain']]

// A proposal drawn as one stream split into channels; width = share of votes.
function Stream({ p, big }) {
  const vals = [p.forVotes, p.againstVotes, p.abstainVotes]
  const total = vals[0] + vals[1] + vals[2]
  const W = 1000, H = 200, PER = 100
  const edge = (x, k) => Array.from({ length: (H + PER) / 10 + 1 }, (_, i) => `${(x + Math.sin((i * 10 / PER) * Math.PI * 2 + k) * (big ? 7 : 5)).toFixed(1)},${i * 10}`)
  let acc = 0
  const bounds = [0, ...vals.map((v) => (acc += v, (acc / total) * W))]
  const flat = (x) => [`${x},0`, `${x},${H + PER}`]
  const seg = (i) => {
    const last = vals.slice(i + 1).every((v) => v === 0), first = vals.slice(0, i).every((v) => v === 0)
    const left = first ? flat(-30) : edge(bounds[i], i * 1.9)
    const right = (last ? flat(W + 30) : edge(bounds[i + 1], (i + 1) * 1.9)).reverse()
    return 'M' + [...left, ...right].join('L') + 'Z'
  }
  const aria = `For ${vals[0]}, against ${vals[1]}, abstain ${vals[2]}`
  return (
    <div className={`stream ${big ? 'big' : ''}`} role="img" aria-label={aria}>
      {total ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <g className="flow">{CH.map(([l, c], i) => vals[i] > 0 && <path key={l} d={seg(i)} fill={`var(--${c})`} stroke="var(--water)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}</g>
          </svg>
          <div className="counts">
            {CH.map(([l, c], i) => vals[i] > 0 && <div key={l} className={c} style={{ flex: vals[i] }}><strong>{vals[i]}</strong><span>{l}</span></div>)}
          </div>
        </>
      ) : <div className="dry">No votes yet</div>}
    </div>
  )
}

export default function App() {
  const { address, chainId } = useAccount()
  const acct = address ?? null
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [props, setProps] = useState(null)
  const [view, setView] = useState('list')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [form, setForm] = useState({ title: '', desc: '', dur: 86400 })

  const refresh = useCallback(async () => {
    try { setProps(await load(acct)) } catch { /* transient RPC error, the next poll retries */ }
  }, [acct])

  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [refresh])
  async function ensureChain() { if (chainId !== monad.id) await switchChainAsync({ chainId: monad.id }) }
  async function act(label, functionName, args, done) {
    setBusy(true); setNote(null)
    try {
      await ensureChain()
      const req = { address: GOV, abi: govAbi, functionName, args, account: acct }
      await pc.simulateContract(req)
      const hash = await writeContractAsync({ address: GOV, abi: govAbi, functionName, args, chainId: monad.id })
      setNote({ kind: 'ok', text: `${label} sent. Confirming…`, hash })
      await pc.waitForTransactionReceipt({ hash })
      setNote({ kind: 'ok', text: `${label} confirmed.`, hash })
      await refresh()
      done?.()
    } catch (e) { setNote({ kind: 'err', text: reason(e) }) }
    setBusy(false)
  }

  const now = Math.floor(Date.now() / 1000)
  const status = (p) => (now < Number(p.startTime) ? 'Upcoming' : now > Number(p.endTime) ? 'Closed' : 'Active')
  const create = () => act('Proposal', 'createProposal', [form.title.trim(), form.desc.trim(), BigInt(now - 120), BigInt(now + form.dur)], () => { setForm({ title: '', desc: '', dur: 86400 }); setView('list') })
  const current = typeof view === 'number' ? props?.find((p) => p.id === view) : null

  const left_ = (p) => (status(p) === 'Active' ? left(Number(p.endTime) - now) : status(p))
  const pill = <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" label="Connect wallet" />

  return (
    <div className="site">
      <header>
        <button className="mark" onClick={() => setView('list')} aria-label="Rio, all proposals">Rio</button>
        <nav>
          <button className={view !== 'new' ? 'on' : ''} onClick={() => setView('list')}>Proposals</button>
          <button className={view === 'new' ? 'on' : ''} onClick={() => setView('new')}>New proposal</button>
        </nav>
        {pill}
      </header>

      <main>
        {view === 'list' && (
          <section>
            <p className="kicker">Community governance on Monad</p>
            <h1 className="hero">Every vote moves the river.</h1>
            {!props && <p className="status-line">Reading proposals from Monad Testnet…</p>}
            {props?.length === 0 && <div className="empty"><h2>No proposals yet</h2><button className="big-btn" onClick={() => setView('new')}>Start the first one</button></div>}
            <div className="channels">
              {props?.map((p) => (
                <article key={p.id} className={`channel ${status(p)}`} onClick={() => setView(p.id)} tabIndex={0} role="link" onKeyDown={(e) => e.key === 'Enter' && setView(p.id)}>
                  <div className="ch-head">
                    <h2>{p.title}</h2>
                    <div className="clock"><b>{left_(p)}</b>{status(p) === 'Active' && <small>left</small>}</div>
                  </div>
                  <Stream p={p} />
                  <p className="meta"><span className={`tag ${status(p)}`}>{status(p)}</span><span>by {short(p.creator)}</span>{p.voted && <span className="voted">You voted</span>}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {current && (
          <section>
            <button className="back" onClick={() => setView('list')}>All proposals</button>
            <div className="detail-top">
              <span className={`tag ${status(current)}`}>{status(current)}</span>
              <span className="clock inline"><b>{left_(current)}</b>{status(current) === 'Active' && <small>left</small>}</span>
            </div>
            <h1 className="hero sm">{current.title}</h1>
            <Stream p={current} big />
            <p className="meta"><span>Proposed by {short(current.creator)}</span></p>
            <p className="desc">{current.description || 'No details provided.'}</p>
            <div className="vote">
              {current.voted ? <p className="done">Your vote is recorded onchain.</p> : (
                <div className="btns">
                  {[['For', 1, 'for'], ['Against', 0, 'against'], ['Abstain', 2, 'abstain']].map(([l, sup, c]) => (
                    <button key={l} className={`vb ${c}`} disabled={!acct || busy || status(current) !== 'Active'} onClick={() => act('Vote', 'vote', [BigInt(current.id), sup])}>{l}</button>
                  ))}
                </div>
              )}
              {!acct && !current.voted && <p className="hint">Connect a wallet to vote.</p>}
              {acct && !current.voted && status(current) !== 'Active' && <p className="hint">Voting is {status(current) === 'Closed' ? 'closed' : 'not open yet'}.</p>}
            </div>
          </section>
        )}

        {view === 'new' && (
          <section className="form">
            <p className="kicker">New proposal</p>
            <h1 className="hero sm">What should the community decide?</h1>
            <label>Title<input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Move liquidity to a new pool" /></label>
            <label>Details<textarea rows={5} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Give voters the context they need." /></label>
            <fieldset>
              <legend>Voting stays open for</legend>
              <div className="durs">{DURATIONS.map(([l, v]) => <button type="button" key={v} className={form.dur === v ? 'on' : ''} aria-pressed={form.dur === v} onClick={() => setForm({ ...form, dur: v })}>{l}</button>)}</div>
            </fieldset>
            <button className="big-btn" disabled={!acct || busy || !form.title.trim()} onClick={create}>{acct ? (busy ? 'Creating…' : 'Create proposal') : 'Connect a wallet to create'}</button>
          </section>
        )}
      </main>

      {note && <div className={`note ${note.kind}`} onClick={() => setNote(null)}>{note.text} {note.hash && <a href={`${monad.blockExplorers.default.url}/tx/${note.hash}`} target="_blank" rel="noreferrer">View tx</a>}</div>}
    </div>
  )
}
