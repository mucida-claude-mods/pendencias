import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'pendencias'
const tick = atom({ plugin: 'pendencias', key: 'tick' } as const, 0)
const MAX_DIAS = 14
// Cache de prompt vale 1h: chat parado há menos que isso é "quente" (🔥), senão "frio" (❄️).
const CACHE_MS = 60 * 60 * 1000

type Pendencia = {
  sessionId: string
  project: string
  title: string
  ask: string
  at: number
  dismissed: boolean
  err?: string
}

// Sinais de que a resposta pede algo do usuário. Heurística: sem modelo, sem token.
const PEDE = new RegExp(
  [
    'preciso d[oa] seu', 'aguard(o|ando) (você|voc[eê]|seu|sua|o seu|o ok)', 'me (diga|avise|confirme|responda|passe)',
    'pode (testar|confirmar|aprovar|autorizar|me dizer)', 'quer que eu', 'devo (prosseguir|seguir|continuar|mergear)',
    'posso (prosseguir|seguir|continuar|mergear|aplicar|commitar)', '(seu|dar o|dê o|d[êe] um) ok', 'autoriza', 'aprova(r|ção)?\\b',
    'antes de (seguir|continuar|mergear)', 'sua decisão', 'qual (você prefere|op[cç][aã]o)', 'testa(r)? (no|na) (porta )?8\\d{3}',
    'waiting for (you|your)', 'let me know', 'should i\\b', 'do you want', 'can you confirm', 'please confirm',
  ].join('|'),
  'i',
)

function pedeAlgo(answer: string): string | null {
  const text = answer.trim()
  if (!text) return null
  const tail = text.slice(-700)
  const lines = tail.split('\n').map(l => l.trim()).filter(Boolean)
  const lastLine = lines[lines.length - 1] ?? ''
  if (!lastLine.endsWith('?') && !PEDE.test(tail)) return null
  const pede = (s: string) => s.endsWith('?') || PEDE.test(s)
  // A frase que pede: a última linha que casa, e nela a última frase que casa.
  const line = [...lines].reverse().find(pede) ?? lastLine
  const sentences = line.split(/(?<=[.!?])\s+/)
  const sentence = [...sentences].reverse().find(pede) ?? line
  const q = sentence.replace(/[*_`#>]/g, '').replace(/^(\d+\.|[-•])\s*/, '').trim()
  return q.length > 220 ? q.slice(0, 220).trimEnd() + '…' : q
}

function ago(ms: number): string {
  const m = Math.floor((Date.now() - ms) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`
}

// Corta em n caracteres; o "…" entra só quando cortou (ou sempre, com `always`).
function cut(t: string, n: number, always = false): string {
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t + (always ? '…' : '')
}

// Título que o app mostra na lista lateral: a última entrada `custom-title` do transcript do chat.
async function chatTitle($: any, sessionId: string): Promise<{ title: string; err?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { title: '', err: 'id inválido' }
  try {
    const r = await $.process.run([
      'sh', '-c',
      `grep -h -o '"customTitle":"[^"]*"' "$HOME"/.claude/projects/*/${sessionId}.jsonl | tail -1`,
    ])
    const line = String(r.stdout).trim()
    return line ? { title: String(JSON.parse(`{${line}}`).customTitle ?? '') } : { title: '', err: 'sem título no transcript' }
  } catch (err) {
    return { title: '', err: String((err as Error)?.message ?? err).slice(0, 80) }
  }
}

async function projectOf($: any): Promise<string> {
  try {
    return String(await $.session.root())
  } catch {
    return String(await $.session.cwd())
  }
}

async function all($: any): Promise<Pendencia[]> {
  const out: Pendencia[] = []
  for (const k of await $.store.keys()) {
    if (!k.startsWith('p:')) continue
    const v = (await $.store.get(k)) as Pendencia | undefined
    if (v) out.push(v)
  }
  return out
}

export const register: Register = on => {
  let title = ''

  on('session.start', async ($, e, next) => {
    for (const k of await $.store.keys()) {
      if (!k.startsWith('p:')) continue
      const v = (await $.store.get(k)) as Pendencia | undefined
      if (!v || Date.now() - v.at > MAX_DIAS * 86400000) await $.store.delete(k)
    }
    await $.command.register({ name: 'pendencias', description: 'Abre a lista de chats pendentes deste projeto' })
    void $.ui.open({ id: PANE, title: 'Pendências' })
    // Redesenha a cada minuto: 🔥→❄️ e "há N min" mudam com o tempo, sem nenhum evento do chat.
    $.clock.every(60_000, () => update($, tick, n => n + 1))
    return next(e)
  })

  on('command.run', { command: 'pendencias' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Pendências' })
    return { text: 'Painel de pendências aberto.' }
  })

  on('turn.start', async ($, e, next) => {
    if ((e as any).agentId === undefined && !title && e.prompt?.trim()) title = e.prompt.trim().replace(/\s+/g, ' ').slice(0, 70)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if ((e as any).agentId !== undefined || e.reason !== 'answer') return ran
    const sessionId = String(await $.session.id())
    const ask = pedeAlgo(e.answer)
    if (ask) {
      const p: Pendencia = {
        sessionId,
        project: await projectOf($),
        title: title || ask.slice(0, 70),
        ask,
        at: Date.now(),
        dismissed: false,
      }
      // Grava já, com o que se sabe; o título da lista lateral entra depois e não pode travar isto.
      await $.store.set(`p:${sessionId}`, p)
      await update($, tick, n => n + 1)
      const t = await chatTitle($, sessionId)
      if (t.title) {
        title = t.title
        p.title = t.title
      }
      p.err = t.err
      await $.store.set(`p:${sessionId}`, p)
    } else {
      await $.store.delete(`p:${sessionId}`)
    }
    await update($, tick, n => n + 1)
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, tick)
    const list = (await all($))
      .filter(p => !p.dismissed)
      .sort((a, b) => b.at - a.at)
    // Um grupo por pasta de projeto; o grupo com a pendência mais recente vem primeiro.
    const groups = new Map<string, Pendencia[]>()
    for (const p of list) groups.set(p.project, [...(groups.get(p.project) ?? []), p])
    const nameOf = (project: string) => project.split('/').filter(Boolean).pop() ?? project

    return (
      <Box flexDirection="column">
        <Text dimColor>Pendências{list.length === 0 ? ': nenhuma' : ` (${list.length})`}</Text>
        {[...groups].map(([project, items]) => (
          <Box key={project} flexDirection="column">
            <Text bold>{nameOf(project)} ({items.length})</Text>
            {items.map(p => (
          <Box key={p.sessionId}>
            <Button
              key={`o-${p.sessionId}`}
              label={`${Date.now() - p.at < CACHE_MS ? '🔥' : '❄️'} ${cut(p.title, 38)} · ${ago(p.at)}`}
              onPress={() => $.ui.toast(cut(p.ask, 60, true) + (p.err ? `  [título: ${p.err}]` : ''))}
            />
            <Button
              key={`d-${p.sessionId}`}
              label="×"
              onPress={async () => {
                await $.store.set(`p:${p.sessionId}`, { ...p, dismissed: true })
                await update($, tick, n => n + 1)
              }}
            />
          </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
