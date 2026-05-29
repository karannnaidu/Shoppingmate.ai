import WebSocket from '../../node_modules/.pnpm/ws@8.20.0/node_modules/ws/wrapper.mjs';

const API = 'https://api-production-1ea1.up.railway.app';
const MID = 'SM-2SCCLZ';

const QUESTIONS = [
  'What does Calmosis make? Give me a one-sentence summary.',
  'What is the difference between Peace and Sleep?',
  'What dosage should I take?',
  'Can I talk to a doctor before ordering?',
];

async function runOne(question, idx) {
  console.log(`\n=== Q${idx + 1}: ${question} ===`);
  const sessRes = await fetch(`${API}/v1/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://calmosis.com',
      Referer: 'https://calmosis.com/',
    },
    body: JSON.stringify({ merchantId: MID, domain: 'calmosis.com' }),
  });
  const sess = await sessRes.json();
  if (!sess.wsUrl) {
    console.log('SESSION ERR:', sess);
    return;
  }
  const sessionId = sess.sessionId;

  const ws = new WebSocket(sess.wsUrl);
  let said = '';
  let toolCalls = [];
  let ended = false;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      ended = true;
      try {
        ws.close();
      } catch {}
      resolve();
    }, 25000);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'user_text',
          sessionId,
          text: question,
          mode: 'text',
        }),
      );
    });

    ws.on('message', (data) => {
      try {
        const ev = JSON.parse(data.toString());
        console.log('  ev:', JSON.stringify(ev).slice(0, 200));
        if (ev.type === 'say' && ev.text) said += ev.text + ' ';
        if (ev.type === 'say_partial' && ev.text) said = ev.text;
        if (ev.type === 'tool_result') toolCalls.push(ev.toolName);
        if (ev.type === 'end_of_turn') {
          ended = true;
          clearTimeout(timer);
          try {
            ws.close();
          } catch {}
          resolve();
        }
        if (ev.type === 'session_closed') {
          ended = true;
          clearTimeout(timer);
          resolve();
        }
      } catch (err) {
        console.log('parse err:', err.message);
      }
    });

    ws.on('error', (err) => {
      console.log('WS ERR:', err.message);
      ended = true;
      clearTimeout(timer);
      resolve();
    });
  });

  console.log('ANSWER:', said.trim().slice(0, 600));
  if (toolCalls.length > 0) console.log('TOOLS:', toolCalls.join(', '));
}

for (let i = 0; i < QUESTIONS.length; i++) {
  await runOne(QUESTIONS[i], i);
  await new Promise((r) => setTimeout(r, 800));
}
console.log('\n=== DONE ===');
process.exit(0);
