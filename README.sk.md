# MCP server pre shell

🌍 **Jazyky:** [English](README.md) | [Slovenčina](README.sk.md)

---

MCP server na spúštanie **dlhodobo bežiacich procesov v PTY (pseudo-terminál)** s real-time streamovaním výstupu.

## Kľúčové vlastnosti

- ✅ **Real-time output streaming** - výstup sa streamuje live do terminálu
- ✅ **Interaktívne procesy** - možnosť posielať vstup do bežiaceho procesu
- ✅ **Multiple sessions** - spustiť a kontrolovať viaceré procesy súčasne
- ✅ **Buffered output** - celý výstup sa uchováva a môžeš ho čítať opakovane
- ✅ **PTY emulation** - proces beží ako v skutočnom termináli

## Dostupné nástroje

### 1. `startProcess`
Spustí dlhodobo bežiaci proces v PTY terminále.

**Parametre:**
```javascript
{
  cmd: string,              // príkaz na spustenie
  args: string[],           // pole argumentov
  cwd: string,              // pracovný adresár
  env?: object,             // environment premenné (optional)
  rows?: number,            // výška terminálového okna (optional)
  cols?: number,            // šírka terminálového okna (optional)
  shellOnWindows?: boolean  // použiť shell na Windows (optional)
}
```

**Výstup:**
```javascript
{
  ok: boolean,
  sessionId: string,  // unique ID pre túto session
  pid: number         // process ID v systéme
}
```

**Príklad:**
```javascript
const result = await startProcess({
  cmd: "npm",
  args: ["run", "dev"],
  cwd: "/Users/bgbruno/project"
});
// → { ok: true, sessionId: "abc-123", pid: 12345 }
```

---

### 2. `getSessionOutput`
Prečíta buffered výstup z bežiacej alebo ukončenej PTY session.

**Parametre:**
```javascript
{
  sessionId: string,  // ID session z startProcess
  fromIndex?: number  // od ktorého riadku čítať (default: 0)
}
```

**Výstup:**
```javascript
{
  ok: boolean,
  sessionId: string,
  isRunning: boolean,      // či proces stále beží
  exitCode: number | null, // exit kód (ak skončil)
  exitSignal: number | null,
  output: [                // pole výstupov
    {
      type: "stdout" | "stderr",
      data: string,        // text výstupu
      timestamp: string    // ISO timestamp
    }
  ],
  totalLines: number       // celkový počet riadkov
}
```

**Príklad:**
```javascript
const output = await getSessionOutput({
  sessionId: "abc-123",
  fromIndex: 0
});

// Čítať len nové riadky (od posledného volania)
const newOutput = await getSessionOutput({
  sessionId: "abc-123",
  fromIndex: output.totalLines
});
```

---

### 3. `writeInput`
Pošle vstup do bežiacej PTY session (simuluje písanie do terminálu).

**Parametre:**
```javascript
{
  sessionId: string,  // ID session
  data: string        // text na odoslanie (napr. "rs\n")
}
```

**Výstup:**
```javascript
{
  ok: boolean
}
```

**Príklad:**
```javascript
// Reštartovať Vite dev server
await writeInput({
  sessionId: "abc-123",
  data: "rs\n"
});

// Potvrdiť yes
await writeInput({
  sessionId: "abc-123",
  data: "y\n"
});

// Ukončiť proces
await writeInput({
  sessionId: "abc-123",
  data: "q\n"
});
```

---

### 4. `stopProcess`
Zastaví bežiacu PTY session.

**Parametre:**
```javascript
{
  sessionId: string  // ID session na zastavenie
}
```

**Výstup:**
```javascript
{
  ok: boolean,
  killed: boolean  // či bol proces zabitý
}
```

**Príklad:**
```javascript
await stopProcess({
  sessionId: "abc-123"
});
```

---

### 5. `listSessions`
Vypíše všetky aktívne PTY sessions.

**Parametre:**
```javascript
{}  // žiadne parametre
```

**Príklad:**
```javascript
const sessions = await listSessions();
// → zoznam všetkých aktívnych sessions
```

---

### 6. `cleanupSessions`
Odstráni ukončené (non-running) sessions z pamäte.

**Parametre:**
```javascript
{
  sessionId?: string  // optional - vyčistiť konkrétnu session
}
```

**Príklad:**
```javascript
// Vyčistiť konkrétnu session
await cleanupSessions({ sessionId: "abc-123" });

// Vyčistiť všetky ukončené sessions
await cleanupSessions({});
```

---

## Typický workflow

### Základné použitie

```javascript
// 1. Spustiť proces
const { sessionId, pid } = await startProcess({
  cmd: "npm",
  args: ["run", "dev"],
  cwd: "/project/path"
});

console.log(`Started process ${pid} with session ${sessionId}`);

// 2. Počkať na inicializáciu
await new Promise(resolve => setTimeout(resolve, 2000));

// 3. Prečítať výstup
const output = await getSessionOutput({ 
  sessionId,
  fromIndex: 0 
});

console.log(`Process is ${output.isRunning ? 'running' : 'stopped'}`);
console.log('Output:', output.output.map(o => o.data).join(''));

// 4. Poslať input (ak treba)
await writeInput({ 
  sessionId, 
  data: "rs\n" 
});

// 5. Prečítať nový výstup
const newOutput = await getSessionOutput({ 
  sessionId,
  fromIndex: output.totalLines 
});

// 6. Zastaviť proces
await stopProcess({ sessionId });
```

---

### Multiple paralelné procesy

```javascript
// Spustiť 3 procesy naraz
const sessions = {
  frontend: await startProcess({
    cmd: "npm", args: ["run", "dev"],
    cwd: "/project/frontend"
  }),
  backend: await startProcess({
    cmd: "node", args: ["server.js"],
    cwd: "/project/backend"
  }),
  tests: await startProcess({
    cmd: "npm", args: ["run", "test:watch"],
    cwd: "/project/tests"
  })
};

// Kontrolovať každý proces zvlášť
for (const [name, session] of Object.entries(sessions)) {
  const output = await getSessionOutput({
    sessionId: session.sessionId,
    fromIndex: 0
  });
  console.log(`${name}: ${output.isRunning ? 'running ✅' : 'stopped ❌'}`);
}

// Poslať input do konkrétneho procesu
await writeInput({ 
  sessionId: sessions.tests.sessionId,
  data: "a\n"  // run all tests
});

// Zastaviť konkrétny proces
await stopProcess({ 
  sessionId: sessions.frontend.sessionId 
});

// Zastaviť všetky
for (const session of Object.values(sessions)) {
  await stopProcess({ sessionId: session.sessionId });
}
```

---

## Kedy použiť shell-bg?

| Situácia | Použiť shell-bg? |
|----------|------------------|
| Dev server (npm run dev, vite, webpack) | ✅ Áno |
| Watch módy (nodemon, jest --watch) | ✅ Áno |
| Long-running procesy (docker-compose up) | ✅ Áno |
| Interaktívne CLI (npm init, git commit) | ✅ Áno |
| Krátke príkazy (ls, cat, grep) | ❌ Nie (použiť mcp8_shell_execute) |
| Jednorázové príkazy s rýchlym výstupom | ❌ Nie (použiť mcp8_shell_execute) |

---

## Porovnanie s inými shell nástrojmi

| Nástroj | Dlhodobé procesy | Výstup v response | Interakcia | Použitie |
|---------|------------------|-------------------|------------|----------|
| **mcp6 (shell-bg)** | ✅ Áno | ✅ Buffer + terminal | ✅ writeInput | Dev servery, watch módy |
| **mcp8 (shell-tumf)** | ❌ Zasekne sa | ✅ Áno | ❌ Nie | ls, cat, grep, git status |
| **mcp7 (shell-hdresearch)** | ❌ Zasekne sa | ✅ Áno | ❌ Nie | Základné príkazy |
| **run_command** | ⚠️ Blocking/Async | ⚠️ Čiastočne | ❌ Nie | Štandardné príkazy s user schválením |

---

## Príklady použitia

### Dev server debugging

```javascript
// Spustiť Vite
const { sessionId } = await startProcess({
  cmd: "npm",
  args: ["run", "dev"],
  cwd: "/project"
});

// Počkať 2s
await new Promise(r => setTimeout(r, 2000));

// Prečítať output a hľadať error
const output = await getSessionOutput({ sessionId });
const hasError = output.output.some(o => 
  o.data.includes('error') || o.data.includes('Error')
);

if (hasError) {
  console.log('❌ Dev server má chybu!');
  // Výpis error logu
  output.output
    .filter(o => o.type === 'stderr')
    .forEach(o => console.error(o.data));
}

// Reštart servera
await writeInput({ sessionId, data: "rs\n" });

// Zastaviť
await stopProcess({ sessionId });
```

---

### Docker Compose management

```javascript
// Spustiť docker-compose
const { sessionId } = await startProcess({
  cmd: "docker-compose",
  args: ["up"],
  cwd: "/project/docker"
});

// Sledovať logy
const checkLogs = async () => {
  const output = await getSessionOutput({ 
    sessionId,
    fromIndex: 0 
  });
  
  const isReady = output.output.some(o => 
    o.data.includes('database system is ready')
  );
  
  return isReady;
};

// Počkať kým DB nie je ready
while (!(await checkLogs())) {
  await new Promise(r => setTimeout(r, 1000));
}

console.log('✅ Docker Compose is ready!');

// Zastaviť (Ctrl+C)
await writeInput({ sessionId, data: "\x03" });
```

---

## Tipy & Triky

### 1. **Inkrementálne čítanie výstupu**
```javascript
let lastIndex = 0;

setInterval(async () => {
  const output = await getSessionOutput({ 
    sessionId,
    fromIndex: lastIndex 
  });
  
  // Len nové riadky
  output.output.forEach(o => console.log(o.data));
  
  lastIndex = output.totalLines;
}, 1000);
```

### 2. **Graceful shutdown**
```javascript
// Pokúsiť sa ukončiť "nice"
await writeInput({ sessionId, data: "q\n" });
await new Promise(r => setTimeout(r, 1000));

// Force kill ak stále beží
const status = await getSessionOutput({ sessionId });
if (status.isRunning) {
  await stopProcess({ sessionId });
}
```

### 3. **Timeout pre startup**
```javascript
const waitForReady = async (sessionId, timeout = 10000) => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const output = await getSessionOutput({ sessionId });
    const ready = output.output.some(o => o.data.includes('ready'));
    
    if (ready) return true;
    if (!output.isRunning) throw new Error('Process died');
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  throw new Error('Timeout waiting for ready');
};

const { sessionId } = await startProcess({...});
await waitForReady(sessionId);
console.log('✅ Process is ready!');
```

---

## Troubleshooting

### Proces sa hneď ukončí
```javascript
const output = await getSessionOutput({ sessionId });
console.log('Exit code:', output.exitCode);
console.log('Output:', output.output.map(o => o.data).join(''));
// → skontroluj error v výstupe
```

### Výstup je prázdny
```javascript
// Počkaj chvíľu, output môže trvať
await new Promise(r => setTimeout(r, 2000));
const output = await getSessionOutput({ sessionId });
```

### Session not found
```javascript
// Session bola vyčistená - kontroluj listSessions
const sessions = await listSessions();
console.log('Active sessions:', sessions);
```

---

## Best Practices

1. ✅ **Vždy ukladaj sessionId** - potrebuješ ho pre všetky operácie
2. ✅ **Kontroluj isRunning** - pred writeInput skontroluj či proces beží
3. ✅ **Používaj fromIndex** - efektívnejšie čítanie len nových riadkov
4. ✅ **Cleanup sessions** - zavolaj stopProcess keď už nepotrebuješ proces
5. ✅ **Timeout ochrana** - nečakaj donekonečna na output
6. ✅ **Error handling** - kontroluj exitCode a stderr output

---

## Záver

**shell-bg je ideálny pre:**
- 🚀 Dev servery (Vite, webpack, Next.js)
- 🔄 Watch módy (nodemon, jest --watch)
- 🐳 Docker / Docker Compose
- 🧪 Long-running tests
- 💬 Interaktívne CLI nástroje

**Hlavná výhoda:** Real-time stream + interakcia + multiple sessions = plná kontrola! 💪