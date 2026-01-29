"use client";

import { useMemo, useState } from "react";

// ====== TIPI ======
type VentMode = "none" | "o2" | "hfno" | "niv_cpap" | "niv_bipap" | "imv";
type SpO2BandKey = "<85" | "85-88" | "88-92" | "92-96" | "96-100";
type ECTMode = "none" | "iHD" | "CRRT" | "SCUF" | "ECMO" | "CPB" | "DP" | "other";
type PeriodHours = 6 | 12 | 24;
type SkinLoss = "none" | "moderate" | "severe";

// ====== UTILS ======
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** robusto: accetta "94", "94%", "94,0%", "500 ml", "1.200", ecc. */
function parseNum(input: string) {
  const raw = input.trim();
  if (!raw) return null;

  const cleaned = raw.replace(/\s+/g, "").replace(/%/g, "").replace(/[^0-9,.\-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function asMl(n: number | null) {
  if (n === null) return 0;
  return clamp(n, 0, 50000);
}

function scaleTo24h(valueMl: number, periodHours: PeriodHours) {
  const factor = 24 / periodHours;
  return Math.round(valueMl * factor);
}

// ====== SpO2 ======
function spo2Band(spo2: number): SpO2BandKey {
  if (spo2 < 85) return "<85";
  if (spo2 < 88) return "85-88";
  if (spo2 < 92) return "88-92";
  if (spo2 < 96) return "92-96";
  return "96-100";
}

function spo2BandLabel(band: SpO2BandKey) {
  if (band === "<85") return "<85%";
  if (band === "85-88") return "85–88%";
  if (band === "88-92") return "88–92%";
  if (band === "92-96") return "92–96%";
  return "96–100%";
}

function spo2AlertText(spo2: number) {
  if (spo2 < 85) return "🚨 SpO₂ <85%: ipossiemia critica.";
  if (spo2 < 88) return "⚠️ SpO₂ 85–88%: ipossiemia severa.";
  if (spo2 < 92) return "⚠️ SpO₂ 88–92%: borderline (valuta contesto clinico).";
  if (spo2 < 96) return "✅ SpO₂ 92–96%: range ottimale nella maggioranza dei pazienti.";
  return "ℹ️ SpO₂ 96–100%: alto; se appropriato valutare riduzione FiO₂ per evitare iperossia.";
}

// ====== Labels ======
function ventModeLabel(v: VentMode) {
  switch (v) {
    case "none":
      return "Nessuna";
    case "o2":
      return "Ossigenoterapia (basso flusso)";
    case "hfno":
      return "HFNO / Alti flussi";
    case "niv_cpap":
      return "NIV — CPAP";
    case "niv_bipap":
      return "NIV — BiPAP/PSV";
    case "imv":
      return "Ventilazione invasiva (IMV)";
    default:
      return "Nessuna";
  }
}

function ectModeLabel(m: ECTMode) {
  switch (m) {
    case "none":
      return "Nessuna";
    case "iHD":
      return "Emodialisi intermittente (IHD)";
    case "CRRT":
      return "CRRT";
    case "SCUF":
      return "SCUF / Ultrafiltrazione";
    case "DP":
      return "Dialisi peritoneale (DP)";
    case "ECMO":
      return "ECMO";
    case "CPB":
      return "CEC / CPB (circolazione extracorporea)";
    case "other":
      return "Altro";
    default:
      return "Altro";
  }
}

function skinLabel(s: SkinLoss) {
  switch (s) {
    case "none":
      return "Nessuna";
    case "moderate":
      return "Moderata (ferite/medicazioni estese)";
    case "severe":
      return "Severa (ustioni/open abdomen/ampia esposizione)";
    default:
      return "Nessuna";
  }
}

function skinFactor(s: SkinLoss) {
  if (s === "moderate") return 0.15;
  if (s === "severe") return 0.30;
  return 0.0;
}

export default function NewPage() {
  // ====== PERIODO ======
  const [periodHours, setPeriodHours] = useState<PeriodHours>(24);

  // ====== DATI BASE ======
  const [pesoInput, setPesoInput] = useState("");

  // Dialisi cronica + peso secco
  const [dialisiCronica, setDialisiCronica] = useState(false);
  const [pesoSeccoInput, setPesoSeccoInput] = useState("");

  // SpO2: solo attuale
  const [spo2AttualeInput, setSpo2AttualeInput] = useState("");

  // ====== FEBBRE ======
  const [febbre, setFebbre] = useState(false);
  const [tempInput, setTempInput] = useState("37.0");
  const [febbrePersistente24h, setFebbrePersistente24h] = useState(false);
  const [antipiretico, setAntipiretico] = useState(false);

  // ====== VENTILAZIONE ======
  const [ventMode, setVentMode] = useState<VentMode>("none");
  const [fio2Input, setFio2Input] = useState("");
  const [umidificazione, setUmidificazione] = useState(false);

  // ====== CUTE/USTIONI ======
  const [skinLossMode, setSkinLossMode] = useState<SkinLoss>("none");

  // ====== DIURESI: anuria ======
  const [anuria, setAnuria] = useState(false);

  // ====== TOGGLE CHIRURGICO (mostra voci extra) ======
  const [pazienteChirurgico, setPazienteChirurgico] = useState(false);

  // ====== IN a voci ======
  const [inOraleInput, setInOraleInput] = useState("");
  const [inEVInput, setInEVInput] = useState("");
  const [inEnteraleInput, setInEnteraleInput] = useState("");
  const [inFlushInput, setInFlushInput] = useState("");
  const [inAltroInput, setInAltroInput] = useState("");

  // ====== OUT base ======
  const [outDiuresiInput, setOutDiuresiInput] = useState("");
  const [outDrenaggiInput, setOutDrenaggiInput] = useState("");
  const [outVomitoInput, setOutVomitoInput] = useState("");
  const [outAspiratiInput, setOutAspiratiInput] = useState("");
  const [outAltreOutInput, setOutAltreOutInput] = useState("");

  // ====== OUT extra (solo se chirurgico) ======
  const [outFeciStomiaInput, setOutFeciStomiaInput] = useState("");
  const [outSanguinamentiInput, setOutSanguinamentiInput] = useState("");
  const [outFistolaInput, setOutFistolaInput] = useState("");

  // ====== SUDORAZIONE PROFUSA (visibile) ======
  const [sudorazioneProfusa, setSudorazioneProfusa] = useState(false);
  const [outSudorazioneInput, setOutSudorazioneInput] = useState("");

  // ====== ECT separato ======
  const [ectMode, setEctMode] = useState<ECTMode>("none");
  const ectAttiva = ectMode !== "none";
  const [ectRimozioneNettaInput, setEctRimozioneNettaInput] = useState("");

  // =========================
  // RESET
  // =========================
  function resetAll() {
    setPeriodHours(24);

    setPesoInput("");
    setDialisiCronica(false);
    setPesoSeccoInput("");

    setSpo2AttualeInput("");

    setFebbre(false);
    setTempInput("37.0");
    setFebbrePersistente24h(false);
    setAntipiretico(false);

    setVentMode("none");
    setFio2Input("");
    setUmidificazione(false);

    setSkinLossMode("none");
    setAnuria(false);

    setPazienteChirurgico(false);

    setInOraleInput("");
    setInEVInput("");
    setInEnteraleInput("");
    setInFlushInput("");
    setInAltroInput("");

    setOutDiuresiInput("");
    setOutDrenaggiInput("");
    setOutVomitoInput("");
    setOutAspiratiInput("");
    setOutAltreOutInput("");

    setOutFeciStomiaInput("");
    setOutSanguinamentiInput("");
    setOutFistolaInput("");

    setSudorazioneProfusa(false);
    setOutSudorazioneInput("");

    setEctMode("none");
    setEctRimozioneNettaInput("");
  }

  // =========================
  // VALIDAZIONI
  // =========================
  const pesoKg = useMemo(() => {
    const n = parseNum(pesoInput);
    if (n === null) return null;
    if (n <= 0 || n > 300) return null;
    return n;
  }, [pesoInput]);

  const pesoSeccoKg = useMemo(() => {
    if (!dialisiCronica) return null;
    const n = parseNum(pesoSeccoInput);
    if (n === null) return null;
    if (n <= 0 || n > 300) return null;
    return n;
  }, [dialisiCronica, pesoSeccoInput]);

  const deltaPesoVsSecco = useMemo(() => {
    if (!dialisiCronica) return null;
    if (pesoKg === null || pesoSeccoKg === null) return null;
    return Math.round((pesoKg - pesoSeccoKg) * 10) / 10;
  }, [dialisiCronica, pesoKg, pesoSeccoKg]);

  const tempC = useMemo(() => {
    const n = parseNum(tempInput);
    if (n === null) return 37.0;
    return clamp(n, 34, 42);
  }, [tempInput]);

  const ventAttiva = ventMode !== "none";

  const fio2 = useMemo(() => {
    if (!ventAttiva) return null;
    const n = parseNum(fio2Input);
    if (n === null) return null;
    return clamp(n, 21, 100);
  }, [fio2Input, ventAttiva]);

  const spo2Attuale = useMemo(() => {
    const n = parseNum(spo2AttualeInput);
    if (n === null) return null;
    return clamp(n, 50, 100);
  }, [spo2AttualeInput]);

  const diuresiValPeriodo = useMemo(() => {
    const n = parseNum(outDiuresiInput);
    if (n === null) return null;
    return clamp(n, 0, 50000);
  }, [outDiuresiInput]);

  // =========================
  // ALERTS sicurezza
  // =========================
  const diuresiAlert = useMemo(() => {
    if (anuria) return null;
    if (diuresiValPeriodo === null) return "⚠️ Diuresi non inserita: se il paziente non è anurico, compila la diuresi (mL nel periodo).";
    return null;
  }, [anuria, diuresiValPeriodo]);

  const sudorazioneValPeriodo = useMemo(() => {
    if (!sudorazioneProfusa) return null;
    const n = parseNum(outSudorazioneInput);
    if (n === null) return null;
    return clamp(n, 0, 50000);
  }, [sudorazioneProfusa, outSudorazioneInput]);

  const sudorazioneAlert = useMemo(() => {
    if (!sudorazioneProfusa) return null;
    if (sudorazioneValPeriodo === null) return "⚠️ Sudorazione profusa: inserisci una stima dei mL nel periodo.";
    if (sudorazioneValPeriodo === 0) return "⚠️ Sudorazione profusa: valore = 0 (verifica).";
    return null;
  }, [sudorazioneProfusa, sudorazioneValPeriodo]);

  // =========================
  // SOMME IN/OUT (periodo selezionato)
  // =========================
  const inTotalePeriodo = useMemo(() => {
    return Math.round(
      asMl(parseNum(inOraleInput)) +
        asMl(parseNum(inEVInput)) +
        asMl(parseNum(inEnteraleInput)) +
        asMl(parseNum(inFlushInput)) +
        asMl(parseNum(inAltroInput))
    );
  }, [inOraleInput, inEVInput, inEnteraleInput, inFlushInput, inAltroInput]);

  const outExtraPeriodo = useMemo(() => {
    if (!pazienteChirurgico) return 0;
    return Math.round(
      asMl(parseNum(outFeciStomiaInput)) +
        asMl(parseNum(outSanguinamentiInput)) +
        asMl(parseNum(outFistolaInput))
    );
  }, [pazienteChirurgico, outFeciStomiaInput, outSanguinamentiInput, outFistolaInput]);

  const outTotaleSenzaPerspiratioPeriodo = useMemo(() => {
    return Math.round(
      asMl(diuresiValPeriodo) +
        asMl(parseNum(outDrenaggiInput)) +
        asMl(parseNum(outVomitoInput)) +
        asMl(parseNum(outAspiratiInput)) +
        outExtraPeriodo +
        asMl(parseNum(outAltreOutInput)) +
        asMl(sudorazioneValPeriodo) // sudorazione visibile = OUT clinico
    );
  }, [
    diuresiValPeriodo,
    outDrenaggiInput,
    outVomitoInput,
    outAspiratiInput,
    outExtraPeriodo,
    outAltreOutInput,
    sudorazioneValPeriodo,
  ]);

  // scaling a 24h
  const inTotale24h = useMemo(() => scaleTo24h(inTotalePeriodo, periodHours), [inTotalePeriodo, periodHours]);
  const outTotaleSenzaPerspiratio24h = useMemo(
    () => scaleTo24h(outTotaleSenzaPerspiratioPeriodo, periodHours),
    [outTotaleSenzaPerspiratioPeriodo, periodHours]
  );

  // =========================
  // ECT
  // =========================
  const ectRimozioneNettaValPeriodo = useMemo(() => {
    const n = parseNum(ectRimozioneNettaInput);
    if (n === null) return null;
    return clamp(n, 0, 50000);
  }, [ectRimozioneNettaInput]);

  const ectTotale24h = useMemo(() => {
    if (!ectAttiva) return 0;
    const periodo = Math.round(asMl(ectRimozioneNettaValPeriodo));
    return scaleTo24h(periodo, periodHours);
  }, [ectAttiva, ectRimozioneNettaValPeriodo, periodHours]);

  const ectAlert = useMemo(() => {
    if (!ectAttiva) return null;
    if (ectRimozioneNettaValPeriodo === null) return "⚠️ ECT attiva: inserisci la rimozione netta (nel periodo selezionato).";
    if (ectRimozioneNettaValPeriodo === 0) return "⚠️ ECT attiva: rimozione netta = 0 (verifica che sia corretto).";
    return null;
  }, [ectAttiva, ectRimozioneNettaValPeriodo]);

  // =========================
  // PERSPIRATIO (mL/24h)
  // =========================
  const perspiratioMl24h = useMemo(() => {
    if (pesoKg === null) return null;

    const base = pesoKg * 10;
    let factor = 1.0;

    if (febbre) {
      const delta = Math.max(0, tempC - 37.0);
      factor *= 1 + 0.10 * delta;

      if (febbrePersistente24h) {
        factor *= 1 + (antipiretico ? 0.02 : 0.05);
      }
    }

    if (ventAttiva) {
      factor *= umidificazione ? 0.90 : 1.10;
    }

    const sf = skinFactor(skinLossMode);
    if (sf > 0) factor *= 1 + sf;

    return Math.round(base * factor);
  }, [pesoKg, febbre, tempC, febbrePersistente24h, antipiretico, ventAttiva, umidificazione, skinLossMode]);

  // =========================
  // BILANCI (tutti su base 24h)
  // =========================
  const bilancioClinico24h = useMemo(() => Math.round(inTotale24h - outTotaleSenzaPerspiratio24h), [inTotale24h, outTotaleSenzaPerspiratio24h]);

  const bilancioTotaleConPerspiratio24h = useMemo(() => {
    const p = perspiratioMl24h ?? 0;
    return Math.round(inTotale24h - (outTotaleSenzaPerspiratio24h + p));
  }, [inTotale24h, outTotaleSenzaPerspiratio24h, perspiratioMl24h]);

  const bilancioTotaleConPerspiratioEdECT24h = useMemo(() => {
    const p = perspiratioMl24h ?? 0;
    return Math.round(inTotale24h - (outTotaleSenzaPerspiratio24h + p + ectTotale24h));
  }, [inTotale24h, outTotaleSenzaPerspiratio24h, perspiratioMl24h, ectTotale24h]);

  // =========================
  // SpO₂: fascia + alert (solo attuale)
  // =========================
  const spo2BandKey = useMemo(() => {
    if (spo2Attuale === null) return null;
    return spo2Band(spo2Attuale);
  }, [spo2Attuale]);

  const spo2Alert = useMemo(() => {
    if (spo2Attuale === null) return "Inserisci SpO₂ per classificazione (<85, 85–88, 88–92, 92–96, 96–100).";
    return spo2AlertText(spo2Attuale);
  }, [spo2Attuale]);

  // =========================
  // Nota clinica automatica
  // =========================
  const notaClinica = useMemo(() => {
    const p = perspiratioMl24h;
    const tempTxt = febbre ? `${tempC.toFixed(1)}°C` : "afebbrile";
    const bandTxt = spo2BandKey ? spo2BandLabel(spo2BandKey) : "n/d";

    const ventTxt = ventAttiva
      ? `${ventModeLabel(ventMode)}${fio2 !== null ? `, FiO₂ ${fio2}%` : ""}${umidificazione ? ", umidificazione sì" : ", umidificazione no"}`
      : "nessuna";

    const ectTxt =
      ectMode === "none"
        ? "nessuno"
        : `${ectModeLabel(ectMode)} — rimozione netta (24h) ${ectTotale24h} mL${ectAlert ? " (attenzione: dato mancante/zero)" : ""}`;

    const dialisiTxt = dialisiCronica
      ? `Dialisi cronica: sì. Peso secco: ${pesoSeccoKg ?? "n/d"} kg. Δ peso (attuale–secco): ${deltaPesoVsSecco ?? "n/d"} kg.`
      : "Dialisi cronica: no.";

    const factorPeriodo = periodHours === 24 ? "24h" : `${periodHours}h (scalato a 24h)`;
    const skinTxt = `Cute/ustioni/ferite estese: ${skinLabel(skinLossMode)}.`;
    const anuriaTxt = `Anuria: ${anuria ? "sì" : "no"}.`;
    const sudorazioneTxt = sudorazioneProfusa
      ? `Sudorazione profusa: sì (OUT nel periodo ${asMl(sudorazioneValPeriodo)} mL/${periodHours}h).`
      : "Sudorazione profusa: no.";
    const chirTxt = `Paziente chirurgico: ${pazienteChirurgico ? "sì" : "no"}.`;

    const outExtraNota = pazienteChirurgico
      ? `, feci/diarrea/stomia ${asMl(parseNum(outFeciStomiaInput))}, sanguinamenti/perdite ${asMl(parseNum(outSanguinamentiInput))}, fistola/output enterico ${asMl(parseNum(outFistolaInput))}`
      : "";

    const righe = [
      "CareBalance-N — Nota infermieristica (bozza)",
      `Periodo di rilevazione: ${factorPeriodo}. (Perspiratio stimata sempre su 24h)`,
      `Peso attuale: ${pesoKg ?? "n/d"} kg.`,
      dialisiTxt,
      anuriaTxt,
      skinTxt,
      sudorazioneTxt,
      chirTxt,
      `Temperatura: ${tempTxt}${febbrePersistente24h ? " (persistente >24h)" : ""}${antipiretico ? " — antipiretico" : ""}.`,
      `SpO₂: ${spo2Attuale ?? "n/d"}% (fascia ${bandTxt}).`,
      `Ventilazione: ${ventTxt}.`,
      "",
      `IN nel periodo (mL/${periodHours}h): orale ${asMl(parseNum(inOraleInput))}, EV ${asMl(parseNum(inEVInput))}, enterale ${asMl(
        parseNum(inEnteraleInput)
      )}, flush/irrigazioni ${asMl(parseNum(inFlushInput))}, altro ${asMl(parseNum(inAltroInput))}.`,
      `IN totale (24h): ${inTotale24h} mL.`,
      "",
      `OUT nel periodo (mL/${periodHours}h) escl. perspiratio: diuresi ${asMl(diuresiValPeriodo)}, drenaggi ${asMl(
        parseNum(outDrenaggiInput)
      )}, vomito/ristagno gastrico ${asMl(parseNum(outVomitoInput))}, aspirati ${asMl(parseNum(outAspiratiInput))}${outExtraNota}, sudorazione ${asMl(
        sudorazioneValPeriodo
      )}, altre OUT ${asMl(parseNum(outAltreOutInput))}.`,
      `OUT totale (24h, escl. perspiratio): ${outTotaleSenzaPerspiratio24h} mL.`,
      "",
      `Perspiratio stimata (24h): ${p ?? "n/d"} mL.`,
      `Bilancio clinico (24h, IN–OUT): ${bilancioClinico24h} mL.`,
      `Bilancio totale (24h, IN–OUT–perspiratio): ${bilancioTotaleConPerspiratio24h} mL.`,
      "",
      `ECT separato: ${ectTxt}.`,
      `Bilancio totale + ECT (24h, IN–OUT–perspiratio–ECT): ${bilancioTotaleConPerspiratioEdECT24h} mL.`,
      "Nota: sudorazione profusa è OUT clinico (non insensibile).",
      "Nota: IN/OUT clinici sono indipendenti dalla rimozione extracorporea; ECT va documentato separatamente.",
    ];

    return righe.join("\n");
  }, [
    perspiratioMl24h,
    febbre,
    tempC,
    febbrePersistente24h,
    antipiretico,
    spo2Attuale,
    spo2BandKey,
    ventAttiva,
    ventMode,
    fio2,
    umidificazione,
    skinLossMode,
    anuria,
    sudorazioneProfusa,
    sudorazioneValPeriodo,
    periodHours,
    pazienteChirurgico,
    // IN
    inOraleInput,
    inEVInput,
    inEnteraleInput,
    inFlushInput,
    inAltroInput,
    // OUT
    outDrenaggiInput,
    outVomitoInput,
    outAspiratiInput,
    outAltreOutInput,
    outFeciStomiaInput,
    outSanguinamentiInput,
    outFistolaInput,
    inTotale24h,
    outTotaleSenzaPerspiratio24h,
    bilancioClinico24h,
    bilancioTotaleConPerspiratio24h,
    ectMode,
    ectTotale24h,
    ectAlert,
    bilancioTotaleConPerspiratioEdECT24h,
    pesoKg,
    dialisiCronica,
    pesoSeccoKg,
    deltaPesoVsSecco,
    diuresiValPeriodo,
  ]);

  async function copiaNota() {
    try {
      await navigator.clipboard.writeText(notaClinica);
      alert("Nota copiata ✅");
    } catch {
      alert("Copia non riuscita: seleziona la nota e copia manualmente.");
    }
  }

  const febbreElevata = febbre && tempC >= 39.5;

  function onToggleChirurgico(next: boolean) {
    setPazienteChirurgico(next);
    // se lo spengo, azzero le voci extra per evitare che “restino dentro” per sbaglio
    if (!next) {
      setOutFeciStomiaInput("");
      setOutSanguinamentiInput("");
      setOutFistolaInput("");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", maxWidth: 980 }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>CareBalance-N — Nuovo calcolo</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Bilancio idrico con scaling a 24h + perspiratio (stima) + ECT separato. SpO₂ solo attuale con alert.
      </p>

      {/* AZIONI */}
      <section style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button
          onClick={resetAll}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "white",
            color: "#111",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
        <button
          onClick={copiaNota}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Copia nota
        </button>
      </section>

      {/* PERIODO */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Periodo di calcolo</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontWeight: 900 }}>Rilevazione</label>
            <select
              value={periodHours}
              onChange={(e) => setPeriodHours(Number(e.target.value) as PeriodHours)}
              style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "1px solid #111", borderRadius: 10 }}
            >
              <option value={6}>6 ore</option>
              <option value={12}>12 ore</option>
              <option value={24}>24 ore</option>
            </select>
          </div>

          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 26 }}>
            Inserisci i volumi misurati nel periodo selezionato: l’app li <b>scala automaticamente a 24h</b>.
            <br />
            La <b>perspiratio è sempre stimata su 24h</b>.
          </div>
        </div>
      </section>

      {/* DATI BASE */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Dati base</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 900 }}>Peso attuale (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="es. 70 oppure 72,5"
              value={pesoInput}
              onChange={(e) => setPesoInput(e.target.value)}
              style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "2px solid #111", borderRadius: 10 }}
            />
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              {pesoKg === null ? "Inserisci un peso valido (1–300 kg)." : <>Peso registrato: <b>{pesoKg}</b> kg</>}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e5e7eb" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={dialisiCronica} onChange={(e) => setDialisiCronica(e.target.checked)} />
                Dialisi cronica (peso secco)
              </label>

              <div style={{ marginTop: 10, opacity: dialisiCronica ? 1 : 0.55 }}>
                <label style={{ display: "block", fontWeight: 900 }}>Peso secco (kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={!dialisiCronica}
                  placeholder={dialisiCronica ? "es. 68,0" : "—"}
                  value={pesoSeccoInput}
                  onChange={(e) => setPesoSeccoInput(e.target.value)}
                  style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "1px solid #111", borderRadius: 10 }}
                />

                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                  {dialisiCronica ? (
                    deltaPesoVsSecco === null ? (
                      "Inserisci il peso secco per calcolare il differenziale."
                    ) : (
                      <>
                        Differenziale (peso attuale – peso secco):{" "}
                        <b>
                          {deltaPesoVsSecco > 0 ? "+" : ""}
                          {deltaPesoVsSecco} kg
                        </b>
                      </>
                    )
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e5e7eb" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={anuria} onChange={(e) => setAnuria(e.target.checked)} />
                Anuria
              </label>
              {diuresiAlert && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #f59e0b", background: "#fffbeb", color: "#7c2d12", fontWeight: 900 }}>
                  {diuresiAlert}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e5e7eb" }}>
              <label style={{ display: "block", fontWeight: 900 }}>Cute / ustioni / ferite estese</label>
              <select
                value={skinLossMode}
                onChange={(e) => setSkinLossMode(e.target.value as SkinLoss)}
                style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "1px solid #111", borderRadius: 10 }}
              >
                <option value="none">Nessuna</option>
                <option value="moderate">Moderata (+15% perspiratio)</option>
                <option value="severe">Severa (+30% perspiratio)</option>
              </select>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Aumenta la perspiratio stimata (perdite cutanee non facilmente misurabili).
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #e5e7eb" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={pazienteChirurgico} onChange={(e) => onToggleChirurgico(e.target.checked)} />
                Paziente chirurgico (mostra voci extra)
              </label>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Se non selezionato, le voci extra (feci/stomia, sanguinamenti, fistola) non compaiono e non vengono sommate.
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 900 }}>SpO₂ attuale</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="es. 94 oppure 94%"
              value={spo2AttualeInput}
              onChange={(e) => setSpo2AttualeInput(e.target.value)}
              style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "1px solid #111", borderRadius: 10 }}
            />

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {spo2Attuale === null ? (
                spo2Alert
              ) : (
                <>
                  Fascia: <b>{spo2BandLabel(spo2BandKey!)}</b> — {spo2Alert}
                </>
              )}
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #e5e7eb" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={sudorazioneProfusa} onChange={(e) => setSudorazioneProfusa(e.target.checked)} />
                Sudorazione profusa (OUT clinico)
              </label>

              <div style={{ marginTop: 10, opacity: sudorazioneProfusa ? 1 : 0.55 }}>
                <Row label={`Sudorazione (mL/${periodHours}h)`} value={outSudorazioneInput} setValue={setOutSudorazioneInput} />
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                  La sudorazione è una perdita “visibile”: viene sommata alle OUT cliniche (non alla perspiratio).
                </div>
              </div>

              {sudorazioneAlert && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #f59e0b", background: "#fffbeb", color: "#7c2d12", fontWeight: 900 }}>
                  {sudorazioneAlert}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* VENTILAZIONE */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Ventilazione</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontWeight: 900 }}>Modalità</label>
            <select
              value={ventMode}
              onChange={(e) => setVentMode(e.target.value as VentMode)}
              style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "1px solid #111", borderRadius: 10 }}
            >
              <option value="none">Nessuna</option>
              <option value="o2">Ossigenoterapia (basso flusso)</option>
              <option value="hfno">HFNO / Alti flussi</option>
              <option value="niv_cpap">NIV — CPAP</option>
              <option value="niv_bipap">NIV — BiPAP/PSV</option>
              <option value="imv">Ventilazione invasiva (IMV)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 900 }}>FiO₂ (%)</label>
            <input
              type="text"
              inputMode="decimal"
              disabled={!ventAttiva}
              placeholder={ventAttiva ? "es. 35" : "—"}
              value={fio2Input}
              onChange={(e) => setFio2Input(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 16,
                marginTop: 8,
                border: "1px solid #111",
                borderRadius: 10,
                opacity: ventAttiva ? 1 : 0.6,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 900 }}>Umidificazione</label>
            {ventAttiva ? (
              <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <input type="checkbox" checked={umidificazione} onChange={(e) => setUmidificazione(e.target.checked)} />
                Sì
              </label>
            ) : (
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>—</div>
            )}

            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              Vent attiva: umidificazione <b>sì</b> → -10% perspiratio; <b>no</b> → +10%.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          Modalità selezionata: <b>{ventModeLabel(ventMode)}</b>
        </div>
      </section>

      {/* FEBBRE */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Temperatura</h2>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
            <input type="checkbox" checked={febbre} onChange={(e) => setFebbre(e.target.checked)} />
            Febbre
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 900 }}>Temp (°C)</span>
            <select
              disabled={!febbre}
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #111", opacity: febbre ? 1 : 0.6 }}
            >
              <option value="37.0">37.0</option>
              <option value="37.5">37.5</option>
              <option value="38.0">38.0</option>
              <option value="38.5">38.5</option>
              <option value="39.0">39.0</option>
              <option value="39.5">39.5</option>
              <option value="40.0">40.0</option>
              <option value="41.0">41.0</option>
            </select>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input disabled={!febbre} type="checkbox" checked={febbrePersistente24h} onChange={(e) => setFebbrePersistente24h(e.target.checked)} />
            Febbre persistente &gt;24h
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input disabled={!febbre} type="checkbox" checked={antipiretico} onChange={(e) => setAntipiretico(e.target.checked)} />
            Antipiretico
          </label>

          {febbreElevata && (
            <div style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #fb7185", background: "#fff1f2", color: "#7f1d1d", fontWeight: 900 }}>
              ⚠️ Febbre elevata (&ge;39.5°C): aumentato rischio di disidratazione
            </div>
          )}
        </div>
      </section>

      {/* IN/OUT + ECT */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Bilancio idrico — voci (inserisci nel periodo selezionato)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>IN (mL/{periodHours}h)</div>
            <Row label="Orale" value={inOraleInput} setValue={setInOraleInput} />
            <Row label="EV" value={inEVInput} setValue={setInEVInput} />
            <Row label="Enterale" value={inEnteraleInput} setValue={setInEnteraleInput} />
            <Row label="Flush / irrigazioni" value={inFlushInput} setValue={setInFlushInput} />
            <Row label="Altro IN" value={inAltroInput} setValue={setInAltroInput} />

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Somma IN nel periodo</div>
              <div style={{ fontSize: 20, fontWeight: 950 }}>{inTotalePeriodo} mL/{periodHours}h</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Scala a 24h: <b>{inTotale24h} mL/24h</b>
              </div>
            </div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>OUT (mL/{periodHours}h) — escl. perspiratio</div>
            <Row label="Diuresi" value={outDiuresiInput} setValue={setOutDiuresiInput} />
            <Row label="Drenaggi" value={outDrenaggiInput} setValue={setOutDrenaggiInput} />
            <Row label="Vomito / ristagno gastrico" value={outVomitoInput} setValue={setOutVomitoInput} />
            <Row label="Aspirati" value={outAspiratiInput} setValue={setOutAspiratiInput} />

            {pazienteChirurgico && (
              <>
                <Row label="Feci / diarrea / stomia" value={outFeciStomiaInput} setValue={setOutFeciStomiaInput} />
                <Row label="Sanguinamenti / perdite" value={outSanguinamentiInput} setValue={setOutSanguinamentiInput} />
                <Row label="Fistola / output enterico" value={outFistolaInput} setValue={setOutFistolaInput} />
              </>
            )}

            <Row label="Altre OUT" value={outAltreOutInput} setValue={setOutAltreOutInput} />

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Somma OUT nel periodo (senza perspiratio)</div>
              <div style={{ fontSize: 20, fontWeight: 950 }}>{outTotaleSenzaPerspiratioPeriodo} mL/{periodHours}h</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Scala a 24h: <b>{outTotaleSenzaPerspiratio24h} mL/24h</b>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>ECT (rimozione extracorporea) — inserisci nel periodo selezionato</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontWeight: 900 }}>Tipo ECT</label>
              <select
                value={ectMode}
                onChange={(e) => setEctMode(e.target.value as ECTMode)}
                style={{ width: "100%", padding: 12, fontSize: 16, marginTop: 8, border: "1px solid #111", borderRadius: 10 }}
              >
                <option value="none">Nessuna</option>
                <option value="iHD">Emodialisi intermittente (IHD)</option>
                <option value="CRRT">CRRT</option>
                <option value="SCUF">SCUF / Ultrafiltrazione</option>
                <option value="DP">Dialisi peritoneale (DP)</option>
                <option value="ECMO">ECMO</option>
                <option value="CPB">CEC / CPB (circolazione extracorporea)</option>
                <option value="other">Altro</option>
              </select>
            </div>

            <div style={{ opacity: ectAttiva ? 1 : 0.6 }}>
              <Row label={`Rimozione netta (mL/${periodHours}h)`} value={ectRimozioneNettaInput} setValue={setEctRimozioneNettaInput} />
              {!ectAttiva && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Seleziona un tipo ECT per inserire la rimozione.</div>}
            </div>
          </div>

          {ectAlert && (
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid #f59e0b", background: "#fffbeb", color: "#7c2d12", fontWeight: 900 }}>
              {ectAlert}
            </div>
          )}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Somma ECT scalata a 24h</div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>{ectTotale24h} mL/24h</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            Nota: IN/OUT clinici sono indipendenti dai volumi rimossi con circuiti extracorporei; ECT documentato separatamente.
          </div>
        </div>
      </section>

      {/* RISULTATI + NOTA */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Risultati (tutti su base 24h)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Box
            title="Perspiratio stimata"
            value={perspiratioMl24h === null ? "—" : `${perspiratioMl24h} mL/24h`}
            note="Base 10 mL/kg/24h; febbre +10%/°C >37; vent attiva: umidificazione sì -10%, no +10%; cute: +0/+15/+30%."
          />
          <Box title="Bilancio clinico (IN–OUT)" value={`${bilancioClinico24h} mL/24h`} note="OUT = somma voci (incl. sudorazione); perspiratio esclusa." />
          <Box title="Bilancio totale (con perspiratio)" value={`${bilancioTotaleConPerspiratio24h} mL/24h`} note="IN – (OUT + perspiratio)." />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Bilancio totale + ECT</div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>{bilancioTotaleConPerspiratioEdECT24h} mL/24h</div>
        </div>

        <textarea
          readOnly
          value={notaClinica}
          style={{
            width: "100%",
            marginTop: 12,
            minHeight: 280,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
          }}
        />
      </section>
    </main>
  );
}

function Row({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: 10, alignItems: "center", marginTop: 8 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #111", fontSize: 14 }}
      />
    </div>
  );
}

function Box({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 950, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>{note}</div>
    </div>
  );
}
