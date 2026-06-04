// app.jsx — top-level state, routing, theming, tweaks
import React from "react";
import { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSlider, TweakButton } from "./tweaks-panel.jsx";
import { IOSDevice, useIsCompact } from "./ios-frame.jsx";
import { loadState, saveState, todayLabel, medDoses, medAllTaken, makeRandomPerson, uid, loadSession, saveSession } from "./data.jsx";
import { WelcomeScreen, AuthScreen } from "./onboarding.jsx";
import { HomeScreen, DetailScreen } from "./screens-main.jsx";
import { AddMedicineFlow, HistoryScreen } from "./screens-add.jsx";
import { PillNotification } from "./notification.jsx";
import { EditPersonSheet, ShareSheet } from "./person-sheets.jsx";
import { SettingsScreen } from "./screens-settings.jsx";
import { ReportScreen } from "./screens-reports.jsx";

const MAX_PEOPLE = 8, MIN_PEOPLE = 1;

const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "pillSpeed": 1
}/*EDITMODE-END*/;

function themeFor(dark) {
  return dark ? {
    appBg: "#0C0C0C", appBgBlur: "rgba(12,12,12,0.62)", text: "#F4F2EE", subtext: "rgba(244,242,238,0.55)",
    surface: "#1B1916", chip: "rgba(255,255,255,0.07)", hairline: "rgba(255,255,255,0.14)",
  } : {
    appBg: "#F1EFEA", appBgBlur: "rgba(241,239,234,0.72)", text: "#0A0A0A", subtext: "rgba(10,10,10,0.58)",
    surface: "#F3ECE4", chip: "rgba(10,10,10,0.05)", hairline: "rgba(10,10,10,0.13)",
  };
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = themeFor(t.dark);
  const speed = t.pillSpeed;
  const compact = useIsCompact(); // phone-sized viewport → fill the screen, hide dev chrome

  const [session, setSession] = useStateApp(() => loadSession());
  // "keep me signed in" → persist the email; otherwise remember only that they
  // onboarded (so a reload signs them out but doesn't replay the welcome).
  useEffectApp(() => {
    saveSession(session.keep === false ? { onboarded: session.onboarded, email: null } : session);
  }, [session]);
  const getStarted = () => setSession(s => ({ ...s, onboarded: true }));
  const authed = (email, keep) => setSession({ onboarded: true, email, keep: keep !== false });
  const signOut = () => setSession({ onboarded: false, email: null }); // back to Welcome (replays onboarding)

  const [state, setState] = useStateApp(() => loadState());
  const [view, setView] = useStateApp({ name: "home", personId: null });
  const [addOpen, setAddOpen] = useStateApp(false);
  const [celebrate, setCelebrate] = useStateApp(null); // legacy (unused)
  const [burstMedId, setBurstMedId] = useStateApp(null);
  const [notif, setNotif] = useStateApp(null); // { personId, medId, doseId }
  const [editId, setEditId] = useStateApp(null);
  const [shareId, setShareId] = useStateApp(null);

  const stateRef = React.useRef(state);
  stateRef.current = state;

  useEffectApp(() => { saveState(state); }, [state]);

  // Fire a reminder. Prefer someone with an untaken dose; if everyone's caught up,
  // still fire for anyone so the bell always does something (demo).
  const fireNotif = () => {
    const s = stateRef.current;
    if (!s.people.length) return;
    const candidates = s.people.filter(p => p.meds.some(m => medDoses(m).some(d => !d.taken)));
    const pool = candidates.length ? candidates : s.people;
    const p = pool[Math.floor(Math.random() * pool.length)];
    const m = p.meds.find(x => medDoses(x).some(d => !d.taken)) || p.meds[0];
    if (!m) return; // person has no medicines
    const dose = medDoses(m).find(d => !d.taken) || medDoses(m)[0];
    setNotif({ personId: p.id, medId: m.id, doseId: dose.id });
  };

  // auto-fire a reminder shortly after load (the "fast access" demo)
  useEffectApp(() => {
    const t = setTimeout(fireNotif, 2800);
    return () => clearTimeout(t);
  }, []);


  const person = state.people.find(p => p.id === view.personId) || null;

  // ── mutations ──
  const setPersonMeds = (personId, fn) => {
    setState(s => ({
      ...s,
      people: s.people.map(p => p.id === personId ? { ...p, meds: fn(p.meds, p) } : p),
    }));
  };

  const logDose = (person, med, dose) => {
    const now = todayLabel();
    setState(s => ({ ...s, history: [...s.history, {
      doseId: dose.id, medId: med.id, med: med.name, person: person.name, color: person.color,
      day: now.line1, at: now.line2,
    }]}));
  };
  const unlogDose = (doseId) => {
    setState(s => {
      const idx = [...s.history].reverse().findIndex(h => h.doseId === doseId);
      if (idx === -1) return s;
      const real = s.history.length - 1 - idx;
      return { ...s, history: s.history.filter((_, i) => i !== real) };
    });
  };

  const setDoseTaken = (personId, medId, doseId, taken) => {
    setPersonMeds(personId, (meds) => meds.map(m =>
      m.id === medId ? { ...m, doses: medDoses(m).map(d => d.id === doseId ? { ...d, taken, takenBy: taken ? "me" : undefined } : d) } : m));
  };

  const personFullyDone = (p) => p.meds.length > 0 && p.meds.every(m => medAllTaken(m));

  // toggle one specific dose (detail rows + notification)
  const toggleDose = (personId, medId, doseId) => {
    const p = state.people.find(x => x.id === personId);
    if (!p) return;
    const med = p.meds.find(m => m.id === medId);
    if (!med) return;
    const dose = medDoses(med).find(d => d.id === doseId);
    if (!dose) return;
    const willTake = !dose.taken;
    const wasDone = personFullyDone(p);

    setDoseTaken(personId, medId, doseId, willTake);
    if (willTake) logDose(p, med, dose); else unlogDose(doseId);

    if (willTake) {
      const nowDone = p.meds.every(m => m.id === medId
        ? medDoses(m).every(d => d.id === doseId ? true : d.taken)
        : medAllTaken(m));
      if (nowDone && !wasDone) {
        setBurstMedId(medId);
        setTimeout(() => setBurstMedId(cur => cur === medId ? null : cur), 1000);
      }
    }
  };

  // tap a card pill: take the next pending dose, or reset the med if all taken
  const advanceMed = (personId, medId) => {
    const p = state.people.find(x => x.id === personId);
    if (!p) return;
    const med = p.meds.find(m => m.id === medId);
    if (!med) return;
    const doses = medDoses(med);
    const next = doses.find(d => !d.taken);
    if (next) {
      toggleDose(personId, medId, next.id);
    } else {
      doses.forEach(d => unlogDose(d.id));
      setPersonMeds(personId, (meds) => meds.map(m =>
        m.id === medId ? { ...m, doses: medDoses(m).map(d => ({ ...d, taken: false })) } : m));
    }
  };

  const deleteMed = (personId, medId) => {
    const p = state.people.find(x => x.id === personId);
    if (p) { const med = p.meds.find(m => m.id === medId); if (med) medDoses(med).forEach(d => unlogDose(d.id)); }
    setPersonMeds(personId, (meds) => meds.filter(m => m.id !== medId));
  };

  const addMedicine = (personId, med) => {
    setPersonMeds(personId, (meds) => [med, ...meds]); // newest pill first (top of the card)
    setAddOpen(false);
  };

  const updatePerson = (personId, patch) => {
    setState(s => ({ ...s, people: s.people.map(p => p.id === personId ? { ...p, ...patch } : p) }));
  };

  // share a card → add a caretaker who can access + track this person
  const addCaretaker = (personId, name) => {
    setState(s => ({ ...s, people: s.people.map(p => p.id === personId
      ? { ...p, caretakers: [...(p.caretakers || []), { id: uid("ct"), name: (name || "").trim() || "Caretaker", hue: Math.floor(Math.random() * 360) }] }
      : p) }));
  };

  const addPerson = () => {
    setState(s => s.people.length >= MAX_PEOPLE ? s : ({ ...s, people: [...s.people, makeRandomPerson(s.people)] }));
  };
  const removePerson = (personId) => {
    setState(s => s.people.length <= MIN_PEOPLE ? s : ({ ...s, people: s.people.filter(p => p.id !== personId) }));
  };

  const notifPerson = notif ? state.people.find(p => p.id === notif.personId) : null;
  const notifMed = notifPerson ? notifPerson.meds.find(m => m.id === notif.medId) : null;
  const editPerson = editId ? state.people.find(p => p.id === editId) : null;
  const sharePerson = shareId ? state.people.find(p => p.id === shareId) : null;

  return (
    <div style={{ width: "100%", minHeight: compact ? "100dvh" : "100vh", display: "grid", placeItems: "center", padding: compact ? 0 : 24, boxSizing: "border-box" }}>
      <IOSDevice dark={t.dark}>
        {!session.email ? (
          <div style={{ height: "100%", overflowY: "auto", background: theme.appBg }}>
            {session.onboarded
              ? <AuthScreen theme={theme} onAuthed={authed} />
              : <WelcomeScreen theme={theme} onGetStarted={getStarted} />}
          </div>
        ) : (
        <div style={{ position: "relative", height: "100%", background: theme.appBg }}>
          {/* scrollable current screen */}
          <div id="pf-clip" style={{ position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {view.name === "home" && (
              <HomeScreen state={state} theme={theme} speed={speed} burstMedId={burstMedId}
                onOpenPerson={(id) => setView({ name: "detail", personId: id })}
                onTakePill={advanceMed}
                onAddCaretaker={(id) => setShareId(id)}
                onSettings={() => setView({ name: "settings", personId: null })} />
            )}
            {view.name === "detail" && (
              <DetailScreen person={person} theme={theme} speed={speed} burstMedId={burstMedId}
                onBack={() => setView({ name: "home", personId: null })}
                onTakePill={advanceMed}
                onToggleMed={toggleDose}
                onDeleteMed={deleteMed}
                onAddMedicine={() => setAddOpen(true)}
                onAddCaretaker={() => setShareId(person.id)}
                onEdit={() => setEditId(person.id)} />
            )}
            {view.name === "history" && (
              <HistoryScreen state={state} theme={theme}
                onBack={() => setView({ name: "settings", personId: null })} />
            )}
            {view.name === "settings" && (
              <SettingsScreen state={state} theme={theme} dark={t.dark}
                onBack={() => setView({ name: "home", personId: null })}
                onAddPerson={addPerson}
                onRemovePerson={removePerson}
                onToggleDark={() => setTweak("dark", !t.dark)}
                onOpenHistory={() => setView({ name: "history", personId: null })}
                onOpenReports={() => setView({ name: "reports", personId: null })}
                onSignOut={() => { setView({ name: "home", personId: null }); signOut(); }} />
            )}
            {view.name === "reports" && (
              <ReportScreen state={state} theme={theme}
                onBack={() => setView({ name: "settings", personId: null })} />
            )}
          </div>

          {/* overlays — fixed within the device, above the scroll area */}
          {addOpen && person && (
            <AddMedicineFlow theme={theme}
              onCancel={() => setAddOpen(false)}
              onAdd={(med) => addMedicine(person.id, med)} />
          )}
          {notifPerson && notifMed && (
            <PillNotification person={notifPerson} med={notifMed} theme={theme}
              onFill={() => { const dz = medDoses(notifMed).find(d => d.id === notif.doseId); if (dz && !dz.taken) toggleDose(notifPerson.id, notif.medId, notif.doseId); }}
              onOpen={() => { setView({ name: "detail", personId: notifPerson.id }); setNotif(null); }}
              onClose={() => setNotif(null)} />
          )}

          {editPerson && (
            <EditPersonSheet person={editPerson} theme={theme}
              onSave={(patch) => { updatePerson(editPerson.id, patch); setEditId(null); }}
              onCancel={() => setEditId(null)} />
          )}
          {sharePerson && (
            <ShareSheet person={sharePerson} theme={theme}
              onInvite={(name) => addCaretaker(sharePerson.id, name)}
              onClose={() => setShareId(null)} />
          )}
        </div>
        )}
      </IOSDevice>

      {/* dev/demo tweaks panel — desktop only; on a phone it floats over the app.
          Dark mode is reachable from in-app Settings, and reminders auto-fire. */}
      {!compact && (
        <TweaksPanel>
          <TweakSection label="Theme" />
          <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
          <TweakSection label="Pills" />
          <TweakSlider label="Float / rotate speed" value={t.pillSpeed} min={0} max={2.5} step={0.1}
            unit="×" onChange={(v) => setTweak("pillSpeed", v)} />
          <TweakSection label="Notifications" />
          <TweakButton label="Send a reminder" onClick={fireNotif} />
        </TweaksPanel>
      )}
    </div>
  );
}

export default App;
