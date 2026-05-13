import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_HABITS = [
  { id: "career",   label: "Career conversation", prompt: "Who did you connect with?",  emoji: "💼", isDate: false, type: "weekly" },
  { id: "date",     label: "Date",                 prompt: "Who with & where?",           emoji: "🍷", isDate: true,  type: "weekly" },
  { id: "recipe",   label: "New recipe",           prompt: "What did you make?",          emoji: "🍳", isDate: false, type: "weekly" },
  { id: "friends",  label: "Friends catch-up",     prompt: "Who did you see?",            emoji: "🤝", isDate: false, type: "weekly" },
  { id: "reading",  label: "Reading",              prompt: "What are you reading?",       emoji: "📚", isDate: false, type: "nights", target: 3 },
  { id: "spending", label: "Under spending goal",  prompt: "Weekly budget",               emoji: "💳", isDate: false, type: "spending" },
];

const EMOJI_OPTIONS = ["💼","🍷","🍳","🤝","📚","💳","✨","🌿","🎨","🏃","🧘","🎵","🌍","💪","🎯","🌱"];
const DAY_LABELS    = ["M","T","W","T","F","S","S"];
const DAYS_FULL     = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── helpers ───────────────────────────────────────────────────────────────────
function getWeekKey(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0);
  x.setDate(x.getDate() - ((x.getDay()+6)%7));
  return x.toISOString().slice(0,10);
}
function offsetWeek(wk, n) {
  const d = new Date(wk); d.setDate(d.getDate()+n*7); return d.toISOString().slice(0,10);
}
function weekDates(wk) {
  return Array.from({length:7},(_,i)=>{ const d=new Date(wk); d.setDate(d.getDate()+i); return d; });
}
function fmtRange(wk) {
  const [s,e] = [weekDates(wk)[0], weekDates(wk)[6]];
  const mo = d => d.toLocaleDateString("en-AU",{month:"short"});
  return s.getMonth()===e.getMonth() ? `${mo(s)} ${s.getDate()}–${e.getDate()}` : `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}`;
}
function daysLeftInWeek() {
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(getWeekKey()); end.setDate(end.getDate()+6);
  return Math.max(0, Math.round((end-now)/(86400000)));
}
function getStreak(data, id, currentWk) {
  let s=0, wk=currentWk;
  while (isHabitDone(data, id, wk, DEFAULT_HABITS.find(h=>h.id===id))) { s++; wk=offsetWeek(wk,-1); }
  return s;
}
function isHabitDone(data, id, wk, habit) {
  if (!habit) return false;
  if (habit.type==="nights") {
    const nights = data[`${wk}:${id}:nights`] || [];
    return nights.length >= (habit.target||3);
  }
  if (habit.type==="spending") {
    const e = data[`${wk}:${id}`] || {};
    return e.done === true;
  }
  return !!(data[`${wk}:${id}`]?.done);
}

function useConfetti(trigger) {
  const [particles, setParticles] = useState([]);
  useEffect(()=>{
    if(!trigger) return;
    const cols=["#7b6fa0","#a89cc8","#c8b8e8","#e8d8f8","#f0e8ff","#9591a4"];
    setParticles(Array.from({length:48},(_,i)=>({
      id:i, x:Math.random()*100, delay:Math.random()*0.5,
      color:cols[Math.floor(Math.random()*cols.length)],
      size:Math.random()*7+4, dur:Math.random()*0.9+0.9, rot:Math.random()*360
    })));
    setTimeout(()=>setParticles([]),2600);
  },[trigger]);
  return particles;
}

// ── Up Bank ───────────────────────────────────────────────────────────────────
async function fetchUpSpend(token, weekKey) {
  const res = await fetch(`/.netlify/functions/up-spend?weekKey=${weekKey}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Up proxy error ${res.status}`);
  const { total } = await res.json();
  return total;
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step,      setStep]      = useState(0);
  const [name,      setName]      = useState("");
  const [habits,    setHabits]    = useState(DEFAULT_HABITS.map(h=>({...h})));
  const [budget,    setBudget]    = useState("");
  const [upToken,   setUpToken]   = useState("");
  const [editIdx,   setEditIdx]   = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const nameRef = useRef(null);
  useEffect(()=>{ if(step===0) setTimeout(()=>nameRef.current?.focus(),100); },[step]);

  const startEdit = i => { setEditIdx(i); setEditLabel(habits[i].label); setEditEmoji(habits[i].emoji); };
  const saveEdit  = () => {
    setHabits(habits.map((h,i)=>i===editIdx?{...h,label:editLabel||h.label,emoji:editEmoji}:h));
    setEditIdx(null);
  };

  return (
    <div style={{minHeight:"100vh",background:"#eeecf4",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 24px"}}>
      <style>{`
        .ob-card{background:#fff;border-radius:24px;padding:32px 24px;width:100%;max-width:380px;box-shadow:0 4px 24px rgba(0,0,0,.08);}
        .ob-step{font-size:11px;font-weight:700;color:#b8b4c8;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;}
        .ob-title{font-size:24px;font-weight:700;color:#2d2840;line-height:1.2;margin-bottom:8px;}
        .ob-sub{font-size:14px;color:#9591a4;margin-bottom:24px;line-height:1.5;}
        .ob-input{width:100%;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:14px;padding:14px 16px;font-size:17px;color:#2d2840;outline:none;font-family:inherit;transition:border-color .15s;margin-bottom:10px;}
        .ob-input:focus{border-color:#7b6fa0;}
        .ob-btn{width:100%;background:#7b6fa0;color:#fff;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:12px;transition:opacity .15s;}
        .ob-btn:hover{opacity:.88;}
        .ob-btn:disabled{opacity:.4;cursor:default;}
        .ob-btn-ghost{width:100%;background:#f4f2f9;color:#9591a4;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:8px;}
        .ob-habit-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f8f7fc;border-radius:14px;margin-bottom:8px;cursor:pointer;transition:background .15s;}
        .ob-habit-row:hover{background:#f0eef8;}
        .ob-emoji-grid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;}
        .ob-emoji-btn{width:40px;height:40px;border-radius:10px;border:2px solid transparent;background:#f8f7fc;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
        .ob-emoji-btn.sel{border-color:#7b6fa0;background:#ede9f8;}
        .ob-field-label{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 6px;}
        .ob-prefix{display:flex;align-items:center;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:14px;overflow:hidden;margin-bottom:10px;transition:border-color .15s;}
        .ob-prefix:focus-within{border-color:#7b6fa0;}
        .ob-prefix-sign{padding:14px 4px 14px 16px;font-size:17px;color:#9591a4;font-weight:600;}
        .ob-prefix-input{flex:1;background:transparent;border:none;padding:14px 16px 14px 4px;font-size:17px;color:#2d2840;outline:none;font-family:inherit;}
        .ob-info{background:#f0eef8;border-radius:12px;padding:12px 14px;font-size:12px;color:#7b6fa0;line-height:1.5;margin-bottom:4px;}
      `}</style>
      <div className="ob-card">
        {step===0 && (<>
          <div className="ob-step">Welcome</div>
          <div className="ob-title">What should we call you?</div>
          <div className="ob-sub">We'll personalise your weekly check-ins.</div>
          <input ref={nameRef} className="ob-input" placeholder="Your name" value={name}
            onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&setStep(1)}/>
          <button className="ob-btn" disabled={!name.trim()} onClick={()=>setStep(1)}>Continue →</button>
        </>)}

        {step===1 && editIdx===null && (<>
          <div className="ob-step">Step 2 of 3</div>
          <div className="ob-title">Make it yours, {name.split(" ")[0]}</div>
          <div className="ob-sub">Tap any habit to rename it.</div>
          {habits.map((h,i)=>(
            <div key={h.id} className="ob-habit-row" onClick={()=>startEdit(i)}>
              <span style={{fontSize:22}}>{h.emoji}</span>
              <div style={{flex:1,fontSize:15,fontWeight:600,color:"#2d2840"}}>{h.label}</div>
              <div style={{fontSize:11,color:"#b8b4c8",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>Edit</div>
            </div>
          ))}
          <button className="ob-btn" onClick={()=>setStep(2)}>Continue →</button>
        </>)}

        {step===1 && editIdx!==null && (<>
          <div className="ob-step">Customise habit</div>
          <div className="ob-title">Rename it</div>
          <input className="ob-input" value={editLabel} onChange={e=>setEditLabel(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&saveEdit()} autoFocus/>
          <div className="ob-field-label">Emoji</div>
          <div className="ob-emoji-grid">
            {EMOJI_OPTIONS.map(em=>(
              <button key={em} className={`ob-emoji-btn${editEmoji===em?" sel":""}`} onClick={()=>setEditEmoji(em)}>{em}</button>
            ))}
          </div>
          <button className="ob-btn" onClick={saveEdit}>Save</button>
        </>)}

        {step===2 && (<>
          <div className="ob-step">Step 3 of 3</div>
          <div className="ob-title">Spending goal 💳</div>
          <div className="ob-sub">Set your weekly budget. We'll pull your actual spend from Up Bank automatically.</div>
          <div className="ob-field-label">Weekly budget</div>
          <div className="ob-prefix">
            <span className="ob-prefix-sign">$</span>
            <input className="ob-prefix-input" type="number" placeholder="500" value={budget}
              onChange={e=>setBudget(e.target.value)} autoFocus/>
          </div>
          <div className="ob-field-label">Up Bank personal token</div>
          <input className="ob-input" placeholder="up:yeah:••••••••" value={upToken}
            onChange={e=>setUpToken(e.target.value)} type="password"/>
          <div className="ob-info">
            Get your token in the Up app → Settings → API. It's free and read-only. You can skip this and enter spend manually.
          </div>
          <button className="ob-btn" disabled={!budget} onClick={()=>onDone(name, habits, parseFloat(budget), upToken.trim())}>Let's go →</button>
          <button className="ob-btn-ghost" onClick={()=>onDone(name, habits, parseFloat(budget)||500, "")}>Skip for now</button>
        </>)}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const thisWeek = getWeekKey();
  const [ready,       setReady]       = useState(false);
  const [userName,    setUserName]    = useState("");
  const [habits,      setHabits]      = useState(DEFAULT_HABITS);
  const [weekKey,     setWeekKey]     = useState(thisWeek);
  const [data,        setData]        = useState({});
  const [tab,         setTab]         = useState("home");
  const [logging,     setLogging]     = useState(null);
  const [logText,     setLogText]     = useState("");
  const [celebrated,  setCelebrated]  = useState({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [editingHabit,setEditingHabit]= useState(null);
  const [editLabel,   setEditLabel]   = useState("");
  const [editEmoji,   setEditEmoji]   = useState("");
  const [detailHabit, setDetailHabit] = useState(null);
  const [budget,      setBudget]      = useState(500);
  const [upToken,     setUpToken]     = useState("");
  const [upSpend,     setUpSpend]     = useState(null);
  const [upLoading,   setUpLoading]   = useState(false);
  const [upError,     setUpError]     = useState(null);
  const [showSettings,setShowSettings]= useState(false);
  const inputRef = useRef(null);
  const confettiParticles = useConfetti(showCelebration);

  useEffect(()=>{
    try {
      const s = localStorage.getItem("ritual-v4");
      if (s) {
        const p = JSON.parse(s);
        setUserName(p.userName||""); setHabits(p.habits||DEFAULT_HABITS);
        setData(p.data||{}); setCelebrated(p.celebrated||{});
        setBudget(p.budget||500); setUpToken(p.upToken||"");
        setReady(true);
      }
    } catch { setReady(false); }
  },[]);

  const persist = useCallback((updates) => {
    const state = { userName, habits, data, celebrated, budget, upToken };
    const next  = { ...state, ...updates };
    try { localStorage.setItem("ritual-v4", JSON.stringify(next)); } catch {}
    if (updates.userName   !== undefined) setUserName(updates.userName);
    if (updates.habits     !== undefined) setHabits(updates.habits);
    if (updates.data       !== undefined) setData(updates.data);
    if (updates.celebrated !== undefined) setCelebrated(updates.celebrated);
    if (updates.budget     !== undefined) setBudget(updates.budget);
    if (updates.upToken    !== undefined) setUpToken(updates.upToken);
  }, [userName, habits, data, celebrated, budget, upToken]);

  // fetch Up spend when token + weekKey changes
  useEffect(()=>{
    if (!upToken || !ready) return;
    setUpLoading(true); setUpError(null);
    fetchUpSpend(upToken, weekKey)
      .then(amt => { setUpSpend(amt); setUpLoading(false); })
      .catch(err => { setUpError(err.message); setUpLoading(false); });
  }, [upToken, weekKey, ready]);

  // auto-mark spending done/undone based on Up data
  useEffect(()=>{
    if (upSpend === null) return;
    const k = `${weekKey}:spending`;
    const cur = data[k] || {};
    const shouldBeDone = upSpend <= budget;
    if (cur.done !== shouldBeDone) {
      const newData = { ...data, [k]: { ...cur, done: shouldBeDone, autoAmount: upSpend }};
      setData(newData);
      try { localStorage.setItem("ritual-v4", JSON.stringify({ userName, habits, data: newData, celebrated, budget, upToken })); } catch {}
    }
  }, [upSpend, budget]);

  const onboardDone = (name, newHabits, bud, tok) => {
    const state = { userName:name, habits:newHabits, data:{}, celebrated:{}, budget:bud, upToken:tok };
    try { localStorage.setItem("ritual-v4", JSON.stringify(state)); } catch {}
    setUserName(name); setHabits(newHabits); setBudget(bud); setUpToken(tok);
    setData({}); setCelebrated({}); setReady(true);
  };

  const habitDef   = (id) => habits.find(h=>h.id===id) || DEFAULT_HABITS.find(h=>h.id===id);
  const entry      = (id, wk=weekKey) => data[`${wk}:${id}`] || {};
  const isDone     = (id, wk=weekKey) => isHabitDone(data, id, wk, habitDef(id));
  const nightsDone = (wk=weekKey)     => data[`${wk}:reading:nights`] || [];

  const toggle = id => {
    const h = habitDef(id);
    if (h?.type==="nights" || h?.type==="spending") return; // handled separately
    const k = `${weekKey}:${id}`, cur = entry(id);
    const newData = { ...data, [k]: { ...cur, done: !cur.done }};
    const newTotal = habits.filter(hb => isHabitDone(newData, hb.id, weekKey, hb)).length;
    if (newTotal === habits.length && !celebrated[weekKey]) {
      setShowCelebration(true);
      const nc = { ...celebrated, [weekKey]: true };
      persist({ data: newData, celebrated: nc });
      setTimeout(()=>setShowCelebration(false), 2600);
    } else {
      persist({ data: newData });
    }
    setData(newData);
  };

  const toggleNight = (dayIdx) => {
    const k = `${weekKey}:reading:nights`;
    const cur = data[k] || [];
    const next = cur.includes(dayIdx) ? cur.filter(d=>d!==dayIdx) : [...cur, dayIdx];
    const newData = { ...data, [k]: next };
    persist({ data: newData });
  };

  const openLog = id => {
    setLogText(entry(id).note||"");
    setLogging(id);
    setTimeout(()=>inputRef.current?.focus(),80);
  };
  const saveLog = () => {
    const k=`${weekKey}:${logging}`;
    const newData = {...data,[k]:{...entry(logging),note:logText.trim()}};
    persist({ data: newData });
    setLogging(null);
  };

  const openEditHabit = h => { setEditLabel(h.label); setEditEmoji(h.emoji); setEditingHabit(h.id); };
  const saveEditHabit = () => {
    persist({ habits: habits.map(h => h.id===editingHabit ? {...h,label:editLabel,emoji:editEmoji} : h) });
    setEditingHabit(null);
  };

  if (!ready) return <Onboarding onDone={onboardDone}/>;

  const isNow      = weekKey === thisWeek;
  const dates      = weekDates(weekKey);
  const today      = new Date(); today.setHours(0,0,0,0);
  const totalDone  = habits.filter(h=>isDone(h.id)).length;
  const daysLeft   = daysLeftInWeek();
  const remaining  = habits.length - totalDone;
  const histWeeks  = Array.from({length:12},(_,i)=>offsetWeek(thisWeek,-i));
  const lastMonthMemos = habits.filter(h=>h.type!=="spending"&&h.type!=="nights")
    .map(h=>({...h, note:data[`${offsetWeek(thisWeek,-4)}:${h.id}`]?.note})).filter(h=>h.note);
  const firstName  = userName.split(" ")[0];
  const nights     = nightsDone();
  const nightTarget = 3;
  const spendAmt   = upSpend !== null ? upSpend : (data[`${weekKey}:spending`]?.manualAmount ?? null);
  const spendPct   = spendAmt !== null ? Math.min((spendAmt/budget)*100, 100) : 0;
  const spendOver  = spendAmt !== null && spendAmt > budget;

  return (
    <div style={{minHeight:"100vh",background:"#eeecf4",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        .app{max-width:430px;margin:0 auto;padding:0 16px 80px;}

        .topbar{display:flex;align-items:center;justify-content:space-between;padding:20px 0 14px;}
        .topbar-left .greeting{font-size:20px;font-weight:700;color:#2d2840;}
        .topbar-left .sub{font-size:13px;color:#9591a4;font-weight:500;margin-top:1px;}
        .tab-pills{display:flex;gap:6px;}
        .tab-pill{padding:7px 14px;border-radius:20px;border:none;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;background:#fff;color:#9591a4;transition:all .15s;}
        .tab-pill.active{background:#7b6fa0;color:#fff;}
        .settings-btn{background:none;border:none;cursor:pointer;font-size:20px;padding:4px;color:#9591a4;transition:color .15s;}
        .settings-btn:hover{color:#7b6fa0;}

        .week-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
        .wk-arrow{width:38px;height:38px;border-radius:12px;border:none;background:#fff;cursor:pointer;font-size:18px;color:#7b6fa0;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:all .15s;}
        .wk-arrow:hover{background:#f0eef8;}
        .wk-arrow:disabled{opacity:.3;cursor:default;}
        .wk-center{text-align:center;}
        .wk-range{font-size:14px;font-weight:700;color:#2d2840;}
        .wk-sub{font-size:11px;color:#9591a4;font-weight:600;margin-top:2px;}

        .nudge-card{background:#7b6fa0;border-radius:18px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;}
        .nudge-text{font-size:14px;font-weight:700;color:#fff;}
        .nudge-sub{font-size:12px;color:rgba(255,255,255,.7);margin-top:2px;}
        .nudge-count{font-size:32px;font-weight:700;color:#fff;line-height:1;text-align:center;}
        .nudge-days{font-size:10px;color:rgba(255,255,255,.7);font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-align:center;}

        .progress-card{background:#fff;border-radius:20px;padding:20px 20px 18px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .prog-label{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;}
        .prog-row{display:flex;align-items:baseline;gap:8px;margin-bottom:14px;}
        .prog-big{font-size:42px;font-weight:700;color:#2d2840;line-height:1;}
        .prog-denom{font-size:20px;color:#c4c0d0;font-weight:600;}
        .prog-status{font-size:13px;color:#9591a4;font-weight:500;flex:1;text-align:right;align-self:center;}
        .prog-track{height:6px;background:#f0eef8;border-radius:6px;overflow:hidden;}
        .prog-fill{height:100%;background:#7b6fa0;border-radius:6px;transition:width .5s cubic-bezier(.4,0,.2,1);}

        .day-strip{display:flex;gap:6px;margin-bottom:20px;}
        .day-cell{flex:1;background:#fff;border-radius:14px;padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;box-shadow:0 1px 3px rgba(0,0,0,.05);}
        .day-cell.today{border:2px solid #7b6fa0;}
        .day-letter{font-size:11px;font-weight:700;color:#b8b4c8;letter-spacing:.04em;}
        .day-cell.today .day-letter{color:#7b6fa0;}
        .day-num{font-size:15px;font-weight:700;color:#2d2840;}
        .day-dot{width:5px;height:5px;border-radius:50%;background:#7b6fa0;opacity:0;}
        .day-dot.vis{opacity:1;}

        .section-label{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px;}

        .habit-list{display:flex;flex-direction:column;gap:10px;margin-bottom:22px;}
        .hcard{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .hcard-main{display:flex;align-items:center;padding:16px 16px 16px 18px;gap:12px;}
        .hcard-emoji{font-size:22px;flex-shrink:0;}
        .hcard-body{flex:1;min-width:0;}
        .hcard-name{font-size:15px;font-weight:700;color:#2d2840;display:flex;align-items:center;gap:6px;}
        .hcard.done .hcard-name span.label{color:#b8b4c8;text-decoration:line-through;text-decoration-color:#d4d0e0;}
        .hcard-meta{font-size:12px;color:#b8b4c8;font-weight:500;margin-top:2px;}
        .hcard-meta .streak{color:#7b6fa0;font-weight:700;}
        .hcard-check{width:30px;height:30px;border-radius:50%;border:2.5px solid #e0dcea;background:transparent;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .hcard.done .hcard-check{background:#7b6fa0;border-color:#7b6fa0;}
        .hcard-check svg{opacity:0;transform:scale(0);transition:all .18s;}
        .hcard.done .hcard-check svg{opacity:1;transform:scale(1);}
        .hcard-edit-btn{background:none;border:none;cursor:pointer;font-size:12px;color:#d0cce0;padding:0;font-family:inherit;transition:color .15s;}
        .hcard-edit-btn:hover{color:#7b6fa0;}
        .hcard-note{border-top:1px solid #f4f2f9;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;}
        .hcard-note-text{font-size:13px;color:#6e6880;flex:1;line-height:1.45;}
        .hcard-note-add{font-size:12px;color:#c0bcd0;font-weight:600;}
        .hcard-note:hover .hcard-note-add{color:#9591a4;}
        .hcard-note-edit{font-size:11px;color:#c0bcd0;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}

        /* reading nights */
        .nights-row{border-top:1px solid #f4f2f9;padding:12px 18px;}
        .nights-label{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;}
        .nights-days{display:flex;gap:6px;}
        .night-btn{flex:1;height:34px;border-radius:10px;border:2px solid #e8e4f0;background:#f8f7fc;cursor:pointer;font-size:11px;font-weight:700;color:#b8b4c8;transition:all .2s;font-family:inherit;}
        .night-btn.active{background:#7b6fa0;border-color:#7b6fa0;color:#fff;}
        .nights-progress{font-size:12px;color:#9591a4;font-weight:600;margin-top:8px;}
        .nights-progress .done{color:#7b6fa0;font-weight:700;}

        /* spending card */
        .spend-body{padding:14px 18px;}
        .spend-row{display:flex;align-items:baseline;gap:6px;margin-bottom:10px;}
        .spend-amt{font-size:28px;font-weight:700;line-height:1;}
        .spend-amt.over{color:#e07070;}
        .spend-amt.under{color:#7b6fa0;}
        .spend-amt.neutral{color:#2d2840;}
        .spend-budget{font-size:13px;color:#b8b4c8;font-weight:600;}
        .spend-track{height:6px;background:#f0eef8;border-radius:6px;overflow:hidden;margin-bottom:8px;}
        .spend-fill{height:100%;border-radius:6px;transition:width .5s cubic-bezier(.4,0,.2,1);}
        .spend-status{font-size:12px;font-weight:600;}
        .spend-loading{font-size:13px;color:#b8b4c8;font-style:italic;}
        .spend-manual-row{display:flex;gap:8px;margin-top:10px;}
        .spend-manual-input{flex:1;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#2d2840;outline:none;font-family:inherit;}
        .spend-manual-input:focus{border-color:#7b6fa0;}
        .spend-manual-btn{background:#7b6fa0;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}

        /* memory */
        .memory-card{background:#ede9f8;border-radius:18px;padding:16px 18px;margin-bottom:22px;}
        .memory-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;}
        .memory-item:last-child{margin-bottom:0;}
        .memory-text{font-size:13px;color:#6e6880;line-height:1.45;flex:1;}
        .memory-habit{font-weight:700;color:#7b6fa0;}

        /* history */
        .hist-stats{display:flex;gap:10px;margin-bottom:20px;}
        .stat-card{flex:1;background:#fff;border-radius:16px;padding:14px 14px 12px;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .stat-val{font-size:28px;font-weight:700;color:#2d2840;line-height:1;}
        .stat-lbl{font-size:10px;font-weight:700;color:#b8b4c8;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}
        .hist-list{display:flex;flex-direction:column;gap:8px;}
        .hist-row{background:#fff;border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);cursor:pointer;transition:background .15s;}
        .hist-row:hover{background:#f8f7fc;}
        .hist-row.this-week{border:2px solid #7b6fa0;}
        .hist-date{font-size:12px;font-weight:700;color:#9591a4;width:68px;flex-shrink:0;}
        .hist-pips{display:flex;gap:5px;flex:1;}
        .hist-pip{width:28px;height:28px;border-radius:9px;background:#f4f2f9;display:flex;align-items:center;justify-content:center;font-size:14px;}
        .hist-pip.done{background:#ede9f8;}
        .hist-pip.perfect{background:#7b6fa0;}
        .hist-score{font-size:13px;font-weight:700;color:#b8b4c8;width:28px;text-align:right;}
        .hist-score.full{color:#7b6fa0;}

        /* detail / timeline */
        .detail-overlay{position:fixed;inset:0;background:rgba(30,24,50,.4);z-index:150;display:flex;align-items:flex-end;justify-content:center;}
        .detail-sheet{background:#eeecf4;border-radius:24px 24px 0 0;width:100%;max-width:430px;max-height:85vh;overflow-y:auto;padding:16px 20px 48px;}
        .detail-handle{width:40px;height:4px;background:#d8d4e4;border-radius:2px;margin:0 auto 20px;}
        .detail-title{font-size:22px;font-weight:700;color:#2d2840;margin-bottom:4px;}
        .detail-sub{font-size:13px;color:#9591a4;margin-bottom:24px;}
        .tl-item{display:flex;gap:14px;margin-bottom:16px;}
        .tl-dot{width:10px;height:10px;border-radius:50%;background:#7b6fa0;flex-shrink:0;margin-top:4px;}
        .tl-card{background:#fff;border-radius:14px;padding:12px 14px;flex:1;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .tl-date{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;}
        .tl-note{font-size:14px;color:#2d2840;line-height:1.5;}
        .tl-note-empty{font-size:13px;color:#c0bcd0;font-style:italic;}

        /* settings */
        .settings-overlay{position:fixed;inset:0;background:rgba(30,24,50,.4);z-index:200;display:flex;align-items:flex-end;justify-content:center;}
        .settings-sheet{background:#fff;border-radius:24px 24px 0 0;padding:16px 20px 48px;width:100%;max-width:430px;}
        .settings-handle{width:40px;height:4px;background:#e8e4f0;border-radius:2px;margin:0 auto 20px;}
        .settings-title{font-size:18px;font-weight:700;color:#2d2840;margin-bottom:20px;}
        .settings-field{margin-bottom:16px;}
        .settings-label{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;}
        .settings-input{width:100%;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:12px;padding:12px 14px;font-size:15px;color:#2d2840;outline:none;font-family:inherit;transition:border-color .15s;}
        .settings-input:focus{border-color:#7b6fa0;}
        .settings-prefix{display:flex;align-items:center;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:12px;overflow:hidden;}
        .settings-prefix:focus-within{border-color:#7b6fa0;}
        .settings-prefix-sign{padding:12px 4px 12px 14px;font-size:15px;color:#9591a4;}
        .settings-prefix-input{flex:1;background:transparent;border:none;padding:12px 14px 12px 4px;font-size:15px;color:#2d2840;outline:none;font-family:inherit;}

        /* modals */
        .modal-bg{position:fixed;inset:0;background:rgba(30,24,50,.45);z-index:200;display:flex;align-items:flex-end;justify-content:center;}
        .modal{background:#fff;border-radius:24px 24px 0 0;padding:16px 20px 40px;width:100%;max-width:430px;}
        .modal-handle{width:40px;height:4px;background:#e8e4f0;border-radius:2px;margin:0 auto 20px;}
        .modal-title{font-size:18px;font-weight:700;color:#2d2840;margin-bottom:4px;}
        .modal-prompt{font-size:13px;color:#9591a4;margin-bottom:16px;}
        .modal-input{width:100%;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:14px;padding:14px 16px;font-size:15px;color:#2d2840;resize:none;outline:none;min-height:88px;font-family:inherit;transition:border-color .15s;}
        .modal-input::placeholder{color:#c8c4d8;}
        .modal-input:focus{border-color:#7b6fa0;}
        .modal-input-single{width:100%;background:#f8f7fc;border:1.5px solid #e8e4f0;border-radius:14px;padding:14px 16px;font-size:15px;color:#2d2840;outline:none;font-family:inherit;transition:border-color .15s;margin-bottom:14px;}
        .modal-input-single:focus{border-color:#7b6fa0;}
        .modal-actions{display:flex;gap:10px;margin-top:14px;}
        .btn-primary{flex:1;background:#7b6fa0;color:#fff;border:none;border-radius:14px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s;}
        .btn-primary:hover{opacity:.88;}
        .btn-ghost{background:#f4f2f9;color:#9591a4;border:none;border-radius:14px;padding:15px 20px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;}
        .emoji-grid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px;}
        .emoji-btn{width:40px;height:40px;border-radius:10px;border:2px solid transparent;background:#f8f7fc;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
        .emoji-btn.sel{border-color:#7b6fa0;background:#ede9f8;}
        .field-label{font-size:11px;font-weight:700;color:#9591a4;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 6px;}

        /* celebration */
        .celebration{position:fixed;inset:0;z-index:300;pointer-events:none;display:flex;align-items:center;justify-content:center;}
        .celebration-text{font-size:26px;font-weight:700;color:#2d2840;background:#fff;border-radius:20px;padding:20px 28px;box-shadow:0 8px 32px rgba(0,0,0,.12);text-align:center;animation:celebIn .4s cubic-bezier(.34,1.56,.64,1) both;}
        @keyframes celebIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
        .confetti-piece{position:fixed;top:0;border-radius:2px;animation:fall linear both;pointer-events:none;}
        @keyframes fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}

        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .25s ease both;}
      `}</style>

      {/* confetti */}
      {showCelebration && (
        <div className="celebration">
          {confettiParticles.map(p=>(
            <div key={p.id} className="confetti-piece" style={{left:`${p.x}%`,width:p.size,height:p.size*1.4,background:p.color,animationDuration:`${p.dur}s`,animationDelay:`${p.delay}s`}}/>
          ))}
          <div className="celebration-text">🎉 Perfect week, {firstName}!<br/><span style={{fontSize:15,color:"#9591a4",fontWeight:500}}>All {habits.length} habits done.</span></div>
        </div>
      )}

      <div className="app">
        {/* topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <div className="greeting">Hey, {firstName} 👋</div>
            <div className="sub">{isNow ? (daysLeft===0?"Last day of the week":`${daysLeft} day${daysLeft!==1?"s":""} left`) : fmtRange(weekKey)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div className="tab-pills">
              <button className={`tab-pill${tab==="home"?" active":""}`} onClick={()=>setTab("home")}>Weekly</button>
              <button className={`tab-pill${tab==="history"?" active":""}`} onClick={()=>setTab("history")}>History</button>
            </div>
            <button className="settings-btn" onClick={()=>setShowSettings(true)}>⚙️</button>
          </div>
        </div>

        {/* week nav */}
        <div className="week-nav">
          <button className="wk-arrow" onClick={()=>setWeekKey(k=>offsetWeek(k,-1))}>←</button>
          <div className="wk-center">
            <div className="wk-range">{fmtRange(weekKey)}</div>
            {isNow&&<div className="wk-sub">This week</div>}
          </div>
          <button className="wk-arrow" disabled={isNow} onClick={()=>setWeekKey(k=>offsetWeek(k,1))}>→</button>
        </div>

        {/* ── HOME ── */}
        {tab==="home" && (
          <div className="fade-up">
            {isNow && remaining>0 && daysLeft<=2 && (
              <div className="nudge-card">
                <div>
                  <div className="nudge-text">Don't break your streak!</div>
                  <div className="nudge-sub">{remaining} habit{remaining!==1?"s":""} still to log</div>
                </div>
                <div><div className="nudge-count">{daysLeft}</div><div className="nudge-days">day{daysLeft!==1?"s":""} left</div></div>
              </div>
            )}

            <div className="progress-card">
              <div className="prog-label">This week</div>
              <div className="prog-row">
                <div className="prog-big">{totalDone}</div>
                <div className="prog-denom">/ {habits.length}</div>
                <div className="prog-status">
                  {totalDone===0&&"Not started"}
                  {totalDone===1&&"Getting going"}
                  {totalDone===2&&"Halfway"}
                  {totalDone>2&&totalDone<habits.length&&"Almost there"}
                  {totalDone===habits.length&&"Complete ✦"}
                </div>
              </div>
              <div className="prog-track"><div className="prog-fill" style={{width:`${(totalDone/habits.length)*100}%`}}/></div>
            </div>

            <div className="day-strip">
              {dates.map((d,i)=>{
                const isToday=d.getTime()===today.getTime();
                return (
                  <div key={i} className={`day-cell${isToday?" today":""}`}>
                    <div className="day-letter">{DAY_LABELS[i]}</div>
                    <div className="day-num">{d.getDate()}</div>
                    <div className={`day-dot${isToday&&totalDone>0?" vis":""}`}/>
                  </div>
                );
              })}
            </div>

            <div className="section-label">Habits</div>
            <div className="habit-list">
              {habits.map(h=>{
                const done   = isDone(h.id);
                const note   = entry(h.id).note;
                const streak = getStreak(data, h.id, weekKey);

                // ── reading card ──
                if (h.type==="nights") {
                  const n = nights.length;
                  const hit = n >= nightTarget;
                  return (
                    <div key={h.id} className={`hcard${hit?" done":""}`}>
                      <div className="hcard-main">
                        <div className="hcard-emoji">{h.emoji}</div>
                        <div className="hcard-body">
                          <div className="hcard-name">
                            <span className="label">{h.label}</span>
                            <button className="hcard-edit-btn" onClick={()=>openEditHabit(h)}>✎</button>
                          </div>
                          <div className="hcard-meta">
                            {streak>0?<><span className="streak">🔥 {streak}w</span> · </>:""}
                            {nightTarget} nights/week
                          </div>
                        </div>
                        <div className="hcard-check" style={{pointerEvents:"none"}}>
                          <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1.5 5l3.5 3.5L11.5 1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                      <div className="nights-row">
                        <div className="nights-label">Tap nights you read</div>
                        <div className="nights-days">
                          {DAY_LABELS.map((label,i)=>(
                            <button key={i} className={`night-btn${nights.includes(i)?" active":""}`}
                              onClick={()=>toggleNight(i)}>{label}</button>
                          ))}
                        </div>
                        <div className="nights-progress">
                          <span className="done">{n}</span>/{nightTarget} nights
                          {hit?" ✦ Done!":""}
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── spending card ──
                if (h.type==="spending") {
                  const [manualDraft, setManualDraft] = useState("");
                  return (
                    <div key={h.id} className={`hcard${done?" done":""}`}>
                      <div className="hcard-main">
                        <div className="hcard-emoji">{h.emoji}</div>
                        <div className="hcard-body">
                          <div className="hcard-name">
                            <span className="label">{h.label}</span>
                            <button className="hcard-edit-btn" onClick={()=>openEditHabit(h)}>✎</button>
                          </div>
                          <div className="hcard-meta">
                            {streak>0?<><span className="streak">🔥 {streak}w</span> · </>:""}
                            Goal: ${budget}/wk
                          </div>
                        </div>
                        <div className="hcard-check" style={{pointerEvents:"none"}}>
                          <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1.5 5l3.5 3.5L11.5 1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>
                      <div className="spend-body">
                        {upLoading && <div className="spend-loading">Fetching from Up…</div>}
                        {upError  && <div className="spend-loading" style={{color:"#e07070"}}>Up error — enter manually</div>}
                        {spendAmt !== null && !upLoading && (
                          <>
                            <div className="spend-row">
                              <div className={`spend-amt ${spendOver?"over":spendAmt<budget*0.9?"under":"neutral"}`}>
                                ${spendAmt.toFixed(0)}
                              </div>
                              <div className="spend-budget">/ ${budget}</div>
                              {upToken && !upError && <div style={{fontSize:11,color:"#b8b4c8",marginLeft:"auto",fontWeight:600}}>via Up ↗</div>}
                            </div>
                            <div className="spend-track">
                              <div className="spend-fill" style={{width:`${spendPct}%`,background:spendOver?"#e07070":"#7b6fa0"}}/>
                            </div>
                            <div className={`spend-status`} style={{color:spendOver?"#e07070":done?"#7b6fa0":"#9591a4"}}>
                              {spendOver ? `$${(spendAmt-budget).toFixed(0)} over budget` : done ? `$${(budget-spendAmt).toFixed(0)} under — on track ✦` : `$${(budget-spendAmt).toFixed(0)} remaining`}
                            </div>
                          </>
                        )}
                        {!upToken && spendAmt===null && !upLoading && (
                          <div className="spend-manual-row">
                            <input className="spend-manual-input" type="number" placeholder={`Enter this week's spend`}
                              value={manualDraft} onChange={e=>setManualDraft(e.target.value)}/>
                            <button className="spend-manual-btn" onClick={()=>{
                              const amt=parseFloat(manualDraft);
                              if(isNaN(amt)) return;
                              const k=`${weekKey}:spending`;
                              const newData={...data,[k]:{done:amt<=budget,manualAmount:amt}};
                              persist({data:newData});
                              setManualDraft("");
                            }}>Save</button>
                          </div>
                        )}
                        {!upToken && spendAmt!==null && (
                          <div className="spend-manual-row" style={{marginTop:8}}>
                            <input className="spend-manual-input" type="number" placeholder="Update amount"
                              value={manualDraft} onChange={e=>setManualDraft(e.target.value)}/>
                            <button className="spend-manual-btn" onClick={()=>{
                              const amt=parseFloat(manualDraft);
                              if(isNaN(amt)) return;
                              const k=`${weekKey}:spending`;
                              const newData={...data,[k]:{done:amt<=budget,manualAmount:amt}};
                              persist({data:newData});
                              setManualDraft("");
                            }}>Update</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── standard card ──
                return (
                  <div key={h.id} className={`hcard${done?" done":""}`}>
                    <div className="hcard-main">
                      <div className="hcard-emoji">{h.emoji}</div>
                      <div className="hcard-body">
                        <div className="hcard-name">
                          <span className="label">{h.label}</span>
                          <button className="hcard-edit-btn" onClick={()=>openEditHabit(h)}>✎</button>
                        </div>
                        <div className="hcard-meta">
                          {streak>0?<><span className="streak">🔥 {streak}w</span> · </>:""}{h.prompt}
                        </div>
                      </div>
                      <div className="hcard-check" onClick={()=>toggle(h.id)}>
                        <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1.5 5l3.5 3.5L11.5 1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                    <div className="hcard-note" onClick={()=>{ if(h.isDate) setDetailHabit(h); else openLog(h.id); }}>
                      {note
                        ? <><div className="hcard-note-text">"{note}"</div><div className="hcard-note-edit">{h.isDate?"History →":"Edit"}</div></>
                        : <div className="hcard-note-add">+ {h.prompt}</div>
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {lastMonthMemos.length>0 && (
              <>
                <div className="section-label">This time last month</div>
                <div className="memory-card">
                  {lastMonthMemos.map(h=>(
                    <div key={h.id} className="memory-item">
                      <span style={{fontSize:18}}>{h.emoji}</span>
                      <div className="memory-text"><span className="memory-habit">{h.label}:</span> {h.note}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab==="history" && (
          <div className="fade-up">
            <div style={{height:4}}/>
            <div className="hist-stats">
              <div className="stat-card">
                <div className="stat-val">{histWeeks.filter(wk=>habits.every(h=>isDone(h.id,wk))).length}</div>
                <div className="stat-lbl">Perfect weeks</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{Math.max(...habits.map(h=>getStreak(data,h.id,thisWeek)),0)}</div>
                <div className="stat-lbl">Best streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{Object.keys(data).filter(k=>data[k]?.done).length}</div>
                <div className="stat-lbl">Total done</div>
              </div>
            </div>
            <div className="section-label" style={{marginBottom:10}}>Last 12 weeks</div>
            <div className="hist-list">
              {histWeeks.map(wk=>{
                const score=habits.filter(h=>isDone(h.id,wk)).length;
                const perfect=score===habits.length;
                return (
                  <div key={wk} className={`hist-row${wk===thisWeek?" this-week":""}`}
                    onClick={()=>{ setWeekKey(wk); setTab("home"); }}>
                    <div className="hist-date">{fmtRange(wk)}</div>
                    <div className="hist-pips">
                      {habits.map(h=>(
                        <div key={h.id} className={`hist-pip${isDone(h.id,wk)?(perfect?" perfect":" done"):""}`}>{isDone(h.id,wk)?h.emoji:""}</div>
                      ))}
                    </div>
                    <div className={`hist-score${perfect?" full":""}`}>{score}/{habits.length}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── DATE TIMELINE ── */}
      {detailHabit && (
        <div className="detail-overlay" onClick={e=>e.target===e.currentTarget&&setDetailHabit(null)}>
          <div className="detail-sheet">
            <div className="detail-handle"/>
            <div className="detail-title">{detailHabit.emoji} {detailHabit.label}</div>
            <div className="detail-sub">Every date logged</div>
            {histWeeks.filter(wk=>isDone(detailHabit.id,wk)).length===0
              ? <div style={{textAlign:"center",padding:"40px 0",color:"#b8b4c8",fontSize:14,fontWeight:600}}>Nothing logged yet</div>
              : histWeeks.filter(wk=>isDone(detailHabit.id,wk)).map(wk=>(
                  <div key={wk} className="tl-item">
                    <div className="tl-dot"/>
                    <div className="tl-card">
                      <div className="tl-date">{fmtRange(wk)}</div>
                      {data[`${wk}:${detailHabit.id}`]?.note
                        ? <div className="tl-note">"{data[`${wk}:${detailHabit.id}`].note}"</div>
                        : <div className="tl-note-empty">No details logged</div>}
                    </div>
                  </div>
                ))
            }
            <button style={{width:"100%",background:"#7b6fa0",color:"#fff",border:"none",borderRadius:14,padding:15,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:8}}
              onClick={()=>{ setDetailHabit(null); openLog(detailHabit.id); }}>
              + Log this week's date
            </button>
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {showSettings && (
        <div className="settings-overlay" onClick={e=>e.target===e.currentTarget&&setShowSettings(false)}>
          <div className="settings-sheet">
            <div className="settings-handle"/>
            <div className="settings-title">Settings</div>
            <div className="settings-field">
              <div className="settings-label">Your name</div>
              <input className="settings-input" value={userName}
                onChange={e=>persist({userName:e.target.value})}/>
            </div>
            <div className="settings-field">
              <div className="settings-label">Weekly spending budget</div>
              <div className="settings-prefix">
                <span className="settings-prefix-sign">$</span>
                <input className="settings-prefix-input" type="number" value={budget}
                  onChange={e=>persist({budget:parseFloat(e.target.value)||500})}/>
              </div>
            </div>
            <div className="settings-field">
              <div className="settings-label">Up Bank token</div>
              <input className="settings-input" type="password" value={upToken} placeholder="up:yeah:••••••••"
                onChange={e=>persist({upToken:e.target.value.trim()})}/>
              <div style={{fontSize:12,color:"#9591a4",marginTop:6,lineHeight:1.5}}>Up app → Settings → API → Create token</div>
            </div>
            <button style={{width:"100%",background:"#7b6fa0",color:"#fff",border:"none",borderRadius:14,padding:15,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:8}}
              onClick={()=>setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}

      {/* ── LOG MODAL ── */}
      {logging && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setLogging(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontSize:22}}>{habits.find(h=>h.id===logging)?.emoji}</span>
              <div className="modal-title">{habits.find(h=>h.id===logging)?.label}</div>
            </div>
            <div className="modal-prompt">{habits.find(h=>h.id===logging)?.prompt}</div>
            <textarea ref={inputRef} className="modal-input" value={logText}
              onChange={e=>setLogText(e.target.value)} placeholder="Add details…"
              onKeyDown={e=>e.key==="Enter"&&e.metaKey&&saveLog()}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setLogging(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveLog}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT HABIT MODAL ── */}
      {editingHabit && (
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setEditingHabit(null)}>
          <div className="modal">
            <div className="modal-handle"/>
            <div className="modal-title">Edit habit</div>
            <div className="modal-prompt">Make it personal to you</div>
            <input className="modal-input-single" value={editLabel}
              onChange={e=>setEditLabel(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&saveEditHabit()} autoFocus/>
            <div className="field-label">Emoji</div>
            <div className="emoji-grid">
              {EMOJI_OPTIONS.map(em=>(
                <button key={em} className={`emoji-btn${editEmoji===em?" sel":""}`} onClick={()=>setEditEmoji(em)}>{em}</button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setEditingHabit(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEditHabit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
