import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Camera, BarChart2, Settings, X, Check, List, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

/* ══════════════════════════════════════════════════════
   KATEGORI HIERARKI
══════════════════════════════════════════════════════ */
const PARENT_CATS = [
  {
    id:"makan-minum", label:"Makan & Minum", color:"#F59E0B", bg:"#FEF9EE",
    subcats:[
      { id:"makan-dadakan", label:"Makan dadakan" },
      { id:"jajan-anak",    label:"Jajan anak" },
      { id:"kopi",          label:"Kopi" },
      { id:"susu",          label:"Susu" },
    ]
  },
  {
    id:"tagihan", label:"Tagihan", color:"#EF4444", bg:"#FEF2F2",
    subcats:[
      { id:"internet", label:"Internet" },
      { id:"telepon",  label:"Telepon" },
      { id:"listrik",  label:"Listrik" },
      { id:"air",      label:"Langganan air" },
    ]
  },
  {
    id:"transportasi", label:"Transportasi", color:"#3B82F6", bg:"#EFF6FF",
    subcats:[
      { id:"tol",            label:"Biaya tol" },
      { id:"bensin",         label:"Bensin" },
      { id:"parkir",         label:"Parkir" },
      { id:"perawatan-kend", label:"Perawatan kendaraan" },
      { id:"taxi",           label:"Taxi" },
    ]
  },
  {
    id:"belanja", label:"Belanja", color:"#8B5CF6", bg:"#F5F3FF",
    subcats:[
      { id:"pakaian",         label:"Pakaian" },
      { id:"perlengkapan",    label:"Perlengkapan sehari-hari" },
      { id:"perabot-rumah",   label:"Perabot rumah" },
      { id:"pakan-kucing",    label:"Pakan kucing" },
      { id:"keperluan-dapur", label:"Keperluan dapur" },
    ]
  },
  {
    id:"bepergian", label:"Biaya Bepergian", color:"#06B6D4", bg:"#ECFEFF",
    subcats:[
      { id:"akomodasi-lk",    label:"Akomodasi luar kota" },
      { id:"sewa-hotel",      label:"Sewa hotel" },
      { id:"tiket-antarkota", label:"Tiket transportasi antar kota" },
    ]
  },
  {
    id:"hadiah-donasi", label:"Hadiah & Donasi", color:"#EC4899", bg:"#FDF2F8",
    subcats:[
      { id:"hadiah-teman", label:"Hadiah teman" },
      { id:"sedekah",      label:"Sedekah" },
    ]
  },
  {
    id:"pendidikan", label:"Pendidikan", color:"#F97316", bg:"#FFF7ED",
    subcats:[
      { id:"buku",          label:"Buku" },
      { id:"media-belajar", label:"Media belajar anak" },
      { id:"spp",           label:"SPP Bulanan" },
      { id:"biaya-tahunan", label:"Biaya pendidikan tahunan" },
      { id:"kursus",        label:"Biaya kursus" },
    ]
  },
  {
    id:"kesehatan", label:"Biaya Kesehatan", color:"#10B981", bg:"#F0FDF9",
    subcats:[
      { id:"dokter", label:"Jasa dokter" },
      { id:"obat",   label:"Obat-obatan" },
    ]
  },
  {
    id:"bisnis", label:"Bisnis / Pekerjaan", color:"#6366F1", bg:"#EEF2FF",
    subcats:[
      { id:"langganan-digital", label:"Langganan layanan digital" },
      { id:"akomodasi-dinas",   label:"Akomodasi perjalanan dinas" },
      { id:"cetak-media",       label:"Cetak media ajar" },
    ]
  },
];

/* ── helpers ── */
const getParent = (pid) => PARENT_CATS.find(p => p.id === pid);
const getSubcat = (sid) => { for (const p of PARENT_CATS) { const s = p.subcats.find(s => s.id === sid); if (s) return { ...s, parent: p }; } return null; };
const fmtRp     = (n)   => "Rp\u00a0" + Math.round(n || 0).toLocaleString("id-ID");
const todayStr  = ()    => new Date().toISOString().slice(0, 10);
const mStr      = (d)   => (d || "").slice(0, 7);
const MONTHS    = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const prettyM   = (ym)  => { const [y, m] = ym.split("-"); return `${MONTHS[parseInt(m) - 1]} ${y}`; };

/* ── localStorage ── */
const TX_KEY  = "fin-tx-v1";
const CFG_KEY = "fin-cfg-v1";
const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ── system prompt ── */
const buildSystem = () => {
  const catBlock = PARENT_CATS.map(p =>
    `- ${p.label} (${p.id}):\n` + p.subcats.map(s => `    ${s.id}: ${s.label}`).join("\n")
  ).join("\n");
  return `Kamu adalah asisten pencatat keuangan pribadi yang ringkas dan tepat.
Kamu bisa: (1) catat transaksi baru, (2) ubah kategori transaksi, (3) jawab pertanyaan singkat soal keuangan.

KATEGORI & SUBKATEGORI:
${catBlock}

BALAS HANYA JSON (tanpa backtick):
{
  "reply": "respon singkat 1-2 kalimat, casual, bahasa Indonesia",
  "transactions": [
    { "merchant":"nama","amount":15000,"category":"id_parent","subcategory":"id_sub","date":"YYYY-MM-DD","items":"deskripsi" }
  ],
  "actions": [
    { "type":"update_category","keyword":"kata kunci merchant","new_category":"id_parent","new_subcategory":"id_sub" }
  ]
}

Transaksi baru → "transactions". Edit kategori → "actions". Kalau kosong: [].
Tanggal hari ini: ${todayStr()}. Amount = integer rupiah.`;
};

/* ════════════════════════════════════════════════════ */
export default function App() {
  const [msgs,       setMsgs]      = useState([]);
  const [txList,     setTxList]    = useState([]);
  const [cfg,        setCfg]       = useState({});
  const [loaded,     setLoaded]    = useState(false);
  const [input,      setInput]     = useState("");
  const [imgData,    setImgData]   = useState(null);
  const [imgPrev,    setImgPrev]   = useState(null);
  const [thinking,   setThinking]  = useState(false);
  const [panel,      setPanel]     = useState(null);
  const [selMonth,   setSelMonth]  = useState(todayStr().slice(0, 7));
  const [txMonth,    setTxMonth]   = useState(todayStr().slice(0, 7));
  const [expandedTx, setExpandedTx]= useState(null);
  const [noKey,      setNoKey]     = useState(false);

  const bottomRef = useRef();
  const fileRef   = useRef();
  const inputRef  = useRef();

  /* font */
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);

  /* load */
  useEffect(() => {
    const tx  = lsGet(TX_KEY)  || [];
    const cfg = lsGet(CFG_KEY) || {};
    setTxList(tx);
    setCfg(cfg);
    setLoaded(true);
    setMsgs([{ id:"w", role:"agent", type:"text", ts:Date.now(),
      text:"Halo! 👋 Kirim pengeluaranmu — aku catat otomatis.\n\nContoh:\n• \"makan dadakan di warteg 15rb\"\n• \"bensin pertamini 50000\"\n• \"SPP anak bulan ini 750000\"\n• Upload foto struk atau screenshot mutasi\n\nMau koreksi? Ketik:\n• \"ubah kategori Netflix ke Langganan digital\"" }]);
  }, []);

  /* scroll */
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [msgs, thinking]);

  const saveTx  = (list) => { setTxList(list);  lsSet(TX_KEY, list); };
  const saveCfg = (c)    => { setCfg(c);         lsSet(CFG_KEY, c); };

  /* image */
  const pickImage = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => { const f = e.target.result; setImgPrev(f); setImgData({ data: f.split(",")[1], type: file.type }); };
    r.readAsDataURL(file);
  };
  const clearImg = () => { setImgData(null); setImgPrev(null); };

  /* get API key */
  const getApiKey = () => import.meta.env.VITE_ANTHROPIC_KEY || cfg.apiKey || "";

  /* send */
  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !imgData) || thinking) return;

    const apiKey = getApiKey();
    if (!apiKey) { setNoKey(true); setPanel("settings"); return; }
    setNoKey(false);

    const userMsg = { id:`u_${Date.now()}`, role:"user", type:imgData?"image":"text", text, imgPrev, ts:Date.now() };
    setMsgs(p => [...p, userMsg]);
    setInput(""); clearImg(); setThinking(true);

    const content = imgData
      ? [{ type:"image", source:{ type:"base64", media_type:imgData.type, data:imgData.data } }, { type:"text", text:text||"Ekstrak semua transaksi dari gambar ini." }]
      : text;

    let reply = "Oke!"; let newTxs = []; let actions = [];

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, system:buildSystem(), messages:[{ role:"user", content }] })
      });
      const d   = await res.json();
      const raw = (d.content?.[0]?.text || "").replace(/```[a-z]*/gi,"").replace(/```/g,"").trim();
      const obj = JSON.parse(raw);
      reply   = obj.reply   || "Oke!";
      newTxs  = (obj.transactions || []).map(t => ({
        id: `tx_${Date.now()}_${Math.random()}`,
        merchant:    t.merchant    || "-",
        amount:      Number(t.amount) || 0,
        category:    t.category    || "makan-minum",
        subcategory: t.subcategory || "makan-dadakan",
        date:        t.date        || todayStr(),
        items:       t.items       || "",
        createdAt:   new Date().toISOString(),
      }));
      actions = obj.actions || [];
    } catch {
      reply = "Hmm, coba tulis ulang ya. Contoh: \"makan di warteg 15000\" atau \"bensin 50rb\".";
    }

    /* process actions */
    let updatedTx = [...newTxs, ...txList];
    const actionLog = [];
    for (const a of actions) {
      if (a.type === "update_category") {
        const kw = (a.keyword || "").toLowerCase();
        let count = 0;
        updatedTx = updatedTx.map(t => {
          if (t.merchant.toLowerCase().includes(kw)) { count++; return { ...t, category:a.new_category||t.category, subcategory:a.new_subcategory||t.subcategory }; }
          return t;
        });
        if (count > 0) {
          const sub = getSubcat(a.new_subcategory);
          actionLog.push(`✓ ${count} transaksi "${a.keyword}" → ${sub?.parent.label} › ${sub?.label}`);
        }
      }
    }

    saveTx(updatedTx);
    const finalReply = actionLog.length > 0 ? `${reply}\n\n${actionLog.join("\n")}` : reply;
    setMsgs(p => [...p, { id:`a_${Date.now()}`, role:"agent", type:newTxs.length>0?"transactions":"text", text:finalReply, transactions:newTxs, ts:Date.now() }]);
    setThinking(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [input, imgData, thinking, txList, cfg]);

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  /* tx CRUD */
  const updateTx = (id, patch) => saveTx(txList.map(t => t.id === id ? { ...t, ...patch } : t));
  const deleteTx = (id)        => saveTx(txList.filter(t => t.id !== id));

  /* rekap */
  const monthTx    = txList.filter(t => mStr(t.date) === selMonth);
  const totalMonth = monthTx.reduce((s, t) => s + (t.amount || 0), 0);
  const parentData = PARENT_CATS.map(p => ({ ...p, total:monthTx.filter(t=>t.category===p.id).reduce((s,t)=>s+(t.amount||0),0) })).filter(p => p.total > 0);
  const allMonths  = () => { const s = new Set(txList.map(t => mStr(t.date))); s.add(todayStr().slice(0,7)); return Array.from(s).sort().reverse(); };
  const panelTxs   = txList.filter(t => mStr(t.date) === txMonth).sort((a, b) => b.date.localeCompare(a.date));
  const catVal     = (t) => `${t.category}||${t.subcategory}`;
  const parseCatVal= (v) => { const [c, s] = v.split("||"); return { category:c, subcategory:s }; };

  if (!loaded) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100dvh",fontFamily:"DM Sans,sans-serif",color:"#9CA3AF",fontSize:14 }}>Memuat...</div>;

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100dvh",maxWidth:480,margin:"0 auto",fontFamily:"'DM Sans',sans-serif",background:"#F5F2ED",position:"relative",overflow:"hidden" }}>

      {/* HEADER */}
      <div style={{ background:"#111827",padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div>
          <div style={{ color:"#fff",fontWeight:600,fontSize:15 }}>{cfg.appName || "Keuanganku"}</div>
          <div style={{ color:"#6B7280",fontSize:11 }}>{txList.length} transaksi tersimpan</div>
        </div>
        <div style={{ display:"flex",gap:5 }}>
          {[{ i:<List size={15}/>, id:"tx" },{ i:<BarChart2 size={15}/>, id:"rekap" },{ i:<Settings size={15}/>, id:"settings" }].map(b => (
            <button key={b.id} onClick={() => setPanel(p => p===b.id ? null : b.id)}
              style={{ background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:panel===b.id?"#34D399":"#9CA3AF" }}>
              {b.i}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <div style={{ flex:1,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:10 }}>
        {msgs.map(msg => (
          <div key={msg.id} style={{ display:"flex",justifyContent:msg.role==="agent"?"flex-start":"flex-end" }}>
            <div style={{ maxWidth:"85%" }}>
              <div style={msg.role==="agent"
                ? { background:"#fff",borderRadius:"4px 14px 14px 14px",padding:"10px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)",fontSize:14,color:"#111827",lineHeight:1.55 }
                : { background:"#059669",borderRadius:"14px 4px 14px 14px",padding:"10px 14px",fontSize:14,color:"#fff",lineHeight:1.55,boxShadow:"0 2px 8px rgba(5,150,105,0.25)" }}>
                {msg.imgPrev && <img src={msg.imgPrev} alt="" style={{ maxWidth:200,borderRadius:8,marginBottom:msg.text?6:0,display:"block" }}/>}
                {msg.text && <span style={{ whiteSpace:"pre-wrap" }}>{msg.text}</span>}
                {msg.type==="transactions" && msg.transactions?.length > 0 && (
                  <div style={{ marginTop:10,display:"flex",flexDirection:"column",gap:6 }}>
                    {msg.transactions.map((t, i) => {
                      const par = getParent(t.category) || PARENT_CATS[0];
                      const sub = getSubcat(t.subcategory);
                      return (
                        <div key={i} style={{ background:"#F8FAFC",borderRadius:10,padding:"9px 11px",border:"0.5px solid #E5E7EB",display:"flex",alignItems:"center",gap:10 }}>
                          <div style={{ width:9,height:9,borderRadius:"50%",background:par.color,flexShrink:0 }}/>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:600,color:"#111827",marginBottom:3 }}>{t.merchant}</div>
                            <div style={{ display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" }}>
                              <span style={{ fontSize:10,padding:"1px 7px",borderRadius:20,fontWeight:500,background:par.bg,color:par.color }}>{par.label}</span>
                              {sub && <span style={{ fontSize:10,color:"#6B7280" }}>› {sub.label}</span>}
                            </div>
                            <div style={{ fontSize:10,color:"#CBD5E1",marginTop:2 }}>{t.date}</div>
                          </div>
                          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:"#111827",flexShrink:0 }}>{fmtRp(t.amount)}</div>
                        </div>
                      );
                    })}
                    <div style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#10B981",fontWeight:500,marginTop:2 }}><Check size={11}/> Tersimpan</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize:10,color:"#9CA3AF",marginTop:3,textAlign:msg.role==="agent"?"left":"right",paddingInline:3 }}>
                {new Date(msg.ts).toLocaleTimeString("id-ID",{ hour:"2-digit",minute:"2-digit" })}
              </div>
            </div>
          </div>
        ))}
        {thinking && (
          <div style={{ display:"flex",justifyContent:"flex-start" }}>
            <div style={{ background:"#fff",borderRadius:"4px 14px 14px 14px",padding:"12px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.07)",display:"flex",gap:5,alignItems:"center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#CBD5E1",animation:`blink 1.2s ease-in-out ${i*0.2}s infinite alternate` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
        <style>{`@keyframes blink{from{transform:translateY(0);opacity:.4}to{transform:translateY(-5px);opacity:1}}`}</style>
      </div>

      {/* IMAGE PREVIEW */}
      {imgPrev && (
        <div style={{ background:"#fff",borderTop:"0.5px solid #E5E7EB",padding:"8px 12px",display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
          <img src={imgPrev} alt="" style={{ width:44,height:44,objectFit:"cover",borderRadius:8 }}/>
          <span style={{ fontSize:12,color:"#374151",flex:1 }}>Foto siap dikirim</span>
          <button onClick={clearImg} style={{ background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:4,display:"flex" }}><X size={16}/></button>
        </div>
      )}

      {/* INPUT BAR */}
      <div style={{ background:"#fff",borderTop:"0.5px solid #E5E7EB",padding:"10px 12px",display:"flex",alignItems:"flex-end",gap:8,flexShrink:0 }}>
        <input type="file" ref={fileRef} accept="image/*" style={{ display:"none" }} onChange={e => pickImage(e.target.files[0])}/>
        <button onClick={() => fileRef.current.click()} style={{ background:"#F3F4F6",border:"none",borderRadius:10,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#6B7280",flexShrink:0 }}>
          <Camera size={18}/>
        </button>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
          placeholder="Ketik pengeluaran..."
          style={{ flex:1,resize:"none",border:"none",outline:"none",fontSize:14,fontFamily:"'DM Sans',sans-serif",color:"#111827",background:"transparent",lineHeight:1.5,padding:"4px 0",maxHeight:100,overflowY:"auto" }}
          onInput={e => { e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}/>
        <button onClick={send} disabled={thinking || (!input.trim() && !imgData)}
          style={{ background:(thinking||(!input.trim()&&!imgData))?"#E5E7EB":"#059669",border:"none",borderRadius:10,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:(thinking||(!input.trim()&&!imgData))?"default":"pointer",color:"#fff",flexShrink:0,transition:"background .15s" }}>
          <Send size={16}/>
        </button>
      </div>

      {/* PANELS */}
      {panel && (
        <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",zIndex:40,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={() => setPanel(null)}>
          <div style={{ background:"#fff",borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",maxHeight:"88dvh",overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36,height:4,background:"#E5E7EB",borderRadius:4,margin:"0 auto 20px" }}/>

            {/* TRANSAKSI */}
            {panel==="tx" && (
              <div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                  <div style={{ fontSize:16,fontWeight:600,color:"#111827" }}>Riwayat Transaksi</div>
                  <select value={txMonth} onChange={e => setTxMonth(e.target.value)}
                    style={{ fontSize:12,padding:"5px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#F9FAFB",color:"#374151",cursor:"pointer" }}>
                    {allMonths().map(m => <option key={m} value={m}>{prettyM(m)}</option>)}
                  </select>
                </div>
                {panelTxs.length === 0
                  ? <div style={{ textAlign:"center",padding:"32px 0",color:"#9CA3AF",fontSize:13 }}>Belum ada transaksi periode ini</div>
                  : panelTxs.map(t => {
                    const par = getParent(t.category) || PARENT_CATS[0];
                    const sub = getSubcat(t.subcategory);
                    const isOpen = expandedTx === t.id;
                    return (
                      <div key={t.id} style={{ marginBottom:6 }}>
                        <div onClick={() => setExpandedTx(isOpen ? null : t.id)}
                          style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isOpen?"#F0FDF9":"#F8FAFC",borderRadius:isOpen?"10px 10px 0 0":10,border:"0.5px solid #E5E7EB",cursor:"pointer" }}>
                          <div style={{ width:9,height:9,borderRadius:"50%",background:par.color,flexShrink:0 }}/>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:500,color:"#111827",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{t.merchant}</div>
                            <div style={{ fontSize:11,color:"#9CA3AF" }}>{par.label}{sub?` › ${sub.label}`:""} · {t.date}</div>
                          </div>
                          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:600,color:"#111827",flexShrink:0,marginRight:4 }}>{fmtRp(t.amount)}</div>
                          <div style={{ fontSize:10,color:"#9CA3AF" }}>{isOpen?"▲":"▼"}</div>
                        </div>
                        {isOpen && (
                          <div style={{ background:"#F9FAFB",border:"0.5px solid #E5E7EB",borderTop:"none",borderRadius:"0 0 10px 10px",padding:"12px 12px 10px" }}>
                            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                              <div>
                                <div style={{ fontSize:11,color:"#6B7280",fontWeight:500,marginBottom:4 }}>Merchant</div>
                                <input defaultValue={t.merchant} onBlur={e => updateTx(t.id,{merchant:e.target.value})} style={{ width:"100%",fontSize:12,padding:"6px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#fff",color:"#111827",boxSizing:"border-box",outline:"none" }}/>
                              </div>
                              <div>
                                <div style={{ fontSize:11,color:"#6B7280",fontWeight:500,marginBottom:4 }}>Jumlah (Rp)</div>
                                <input type="number" defaultValue={t.amount} onBlur={e => updateTx(t.id,{amount:parseInt(e.target.value)||0})} style={{ width:"100%",fontSize:12,padding:"6px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#fff",color:"#111827",boxSizing:"border-box",fontFamily:"'DM Mono',monospace",outline:"none" }}/>
                              </div>
                            </div>
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:11,color:"#6B7280",fontWeight:500,marginBottom:4 }}>Kategori › Subkategori</div>
                              <select value={catVal(t)} onChange={e => { const p = parseCatVal(e.target.value); updateTx(t.id, p); }}
                                style={{ width:"100%",fontSize:12,padding:"6px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#fff",color:"#111827",cursor:"pointer",boxSizing:"border-box",outline:"none" }}>
                                {PARENT_CATS.map(p => (
                                  <optgroup key={p.id} label={p.label}>
                                    {p.subcats.map(s => <option key={s.id} value={`${p.id}||${s.id}`}>{s.label}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
                              <div>
                                <div style={{ fontSize:11,color:"#6B7280",fontWeight:500,marginBottom:4 }}>Tanggal</div>
                                <input type="date" defaultValue={t.date} onBlur={e => updateTx(t.id,{date:e.target.value})} style={{ width:"100%",fontSize:12,padding:"6px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#fff",color:"#111827",boxSizing:"border-box",outline:"none" }}/>
                              </div>
                              <div>
                                <div style={{ fontSize:11,color:"#6B7280",fontWeight:500,marginBottom:4 }}>Keterangan</div>
                                <input defaultValue={t.items} onBlur={e => updateTx(t.id,{items:e.target.value})} style={{ width:"100%",fontSize:12,padding:"6px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#fff",color:"#111827",boxSizing:"border-box",outline:"none" }}/>
                              </div>
                            </div>
                            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                              <button onClick={() => setExpandedTx(null)} style={{ fontSize:12,padding:"6px 16px",background:"#059669",color:"#fff",border:"none",borderRadius:7,cursor:"pointer" }}>Selesai</button>
                              <button onClick={() => { if(window.confirm("Hapus transaksi ini?")){ deleteTx(t.id); setExpandedTx(null); } }}
                                style={{ fontSize:12,padding:"6px 10px",background:"transparent",color:"#EF4444",border:"0.5px solid #FCA5A5",borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",gap:4 }}>
                                <Trash2 size={12}/> Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )}

            {/* REKAP */}
            {panel==="rekap" && (
              <div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                  <div style={{ fontSize:16,fontWeight:600,color:"#111827" }}>Rekap Pengeluaran</div>
                  <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
                    style={{ fontSize:12,padding:"5px 8px",borderRadius:7,border:"0.5px solid #E5E7EB",background:"#F9FAFB",color:"#374151",cursor:"pointer" }}>
                    {allMonths().map(m => <option key={m} value={m}>{prettyM(m)}</option>)}
                  </select>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
                  {[{ l:"Total", v:fmtRp(totalMonth) },{ l:"Transaksi", v:monthTx.length }].map(s => (
                    <div key={s.l} style={{ background:"#F8FAFC",borderRadius:12,padding:"12px 14px" }}>
                      <div style={{ fontSize:11,color:"#6B7280",marginBottom:3,fontWeight:500 }}>{s.l}</div>
                      <div style={{ fontSize:15,fontWeight:600,fontFamily:"'DM Mono',monospace",color:"#111827" }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {parentData.length > 0 ? (
                  <>
                    <div style={{ height:150,marginBottom:14 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={parentData} dataKey="total" cx="50%" cy="50%" innerRadius={40} outerRadius={62} stroke="none">
                            {parentData.map(p => <Cell key={p.id} fill={p.color}/>)}
                          </Pie>
                          <Tooltip formatter={v => fmtRp(v)} contentStyle={{ fontSize:12,borderRadius:8,border:"0.5px solid #E5E7EB" }}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {[...parentData].sort((a,b) => b.total-a.total).map(p => {
                      const subBreak = p.subcats
                        .map(s => ({ ...s, total:monthTx.filter(t=>t.subcategory===s.id).reduce((sum,t)=>sum+(t.amount||0),0) }))
                        .filter(s => s.total > 0).sort((a,b) => b.total-a.total);
                      return (
                        <div key={p.id} style={{ marginBottom:12 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                            <div style={{ width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0 }}/>
                            <span style={{ fontSize:13,fontWeight:600,color:"#111827",flex:1 }}>{p.label}</span>
                            <span style={{ fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:600,color:"#111827" }}>{fmtRp(p.total)}</span>
                            <span style={{ fontSize:11,color:"#9CA3AF",minWidth:28,textAlign:"right" }}>{Math.round((p.total/totalMonth)*100)}%</span>
                          </div>
                          {subBreak.map(s => (
                            <div key={s.id} style={{ display:"flex",alignItems:"center",gap:6,paddingLeft:18,marginBottom:2 }}>
                              <div style={{ width:5,height:5,borderRadius:"50%",background:p.color,opacity:0.5 }}/>
                              <span style={{ fontSize:11,color:"#6B7280",flex:1 }}>{s.label}</span>
                              <span style={{ fontSize:11,fontFamily:"'DM Mono',monospace",color:"#374151" }}>{fmtRp(s.total)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                ) : <div style={{ textAlign:"center",padding:"24px 0",color:"#9CA3AF",fontSize:13 }}>Belum ada data periode ini</div>}
              </div>
            )}

            {/* SETTINGS */}
            {panel==="settings" && (
              <div>
                <div style={{ fontSize:16,fontWeight:600,color:"#111827",marginBottom:4 }}>Pengaturan</div>
                <div style={{ fontSize:12,color:"#6B7280",marginBottom:20 }}>Masukkan API Key agar app bisa berjalan.</div>

                {noKey && (
                  <div style={{ background:"#FEF2F2",border:"0.5px solid #FCA5A5",borderRadius:10,padding:"11px 13px",marginBottom:16 }}>
                    <div style={{ fontSize:12,color:"#B91C1C",fontWeight:500 }}>⚠️ API Key belum diisi — app tidak bisa memproses pesan.</div>
                  </div>
                )}

                {[
                  { key:"appName",  label:"Nama App",          ph:"Keuanganku",       type:"text",     mono:false },
                  { key:"apiKey",   label:"Anthropic API Key",  ph:"sk-ant-api03-...", type:"password", mono:true  },
                  { key:"webhookUrl",label:"Google Sheets URL (opsional)", ph:"https://script.google.com/...", type:"url", mono:true },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:12,color:"#374151",fontWeight:500,marginBottom:5 }}>{f.label}</div>
                    <input type={f.type} defaultValue={cfg[f.key]||""} placeholder={f.ph}
                      onBlur={e => saveCfg({ ...cfg, [f.key]:e.target.value })}
                      style={{ width:"100%",fontSize:12,padding:"9px 12px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#F9FAFB",color:"#111827",boxSizing:"border-box",fontFamily:f.mono?"'DM Mono',monospace":"inherit",outline:"none" }}/>
                  </div>
                ))}

                <div style={{ background:"#F0FDF9",border:"0.5px solid #A7F3D0",borderRadius:10,padding:"11px 13px",marginBottom:16 }}>
                  <div style={{ fontSize:12,color:"#065F46",lineHeight:1.7 }}>
                    API Key didapat dari <strong>console.anthropic.com</strong> → API Keys → Create Key
                  </div>
                </div>

                <div style={{ fontSize:11,color:"#9CA3AF" }}>
                  {txList.length} transaksi tersimpan ·{" "}
                  <span onClick={() => { if(window.confirm("Hapus semua data?")){ lsSet(TX_KEY,[]); setTxList([]); } }} style={{ color:"#EF4444",cursor:"pointer" }}>Reset data</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
