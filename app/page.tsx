"use client";

import { useCallback, useEffect, useState } from "react";
import type { DailyEvaluation, TrackingSummary } from "@/lib/types";

function currentDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
}

function statusLabel(day: DailyEvaluation): string {
  return day.status.replaceAll("_", " ");
}

function weekCount(day: DailyEvaluation): string {
  if (day.status === "NO_DATA") return "No data";
  if (day.status === "NOT_ASSIGNED") return "Not assigned";
  if (day.applicableTasks === 0 && day.exemptTasks > 0) return `${day.applicableTasks} applicable · ${day.exemptTasks} exempt`;
  return `${day.completedTasks}/${day.applicableTasks}${day.exemptTasks ? ` · ${day.exemptTasks} exempt` : ""}${day.missedTasks ? ` · ${day.missedTasks} missed` : ""}`;
}

export default function HomePage() {
  const [data, setData] = useState<TrackingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DailyEvaluation | null>(null);
  const today = currentDate();
  const todayEvaluation = data?.currentWeek.find((day) => day.date === today);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tracking?refresh=true", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load tracking data.");
      setData(payload as TrackingSummary);
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load tracking data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <main className="page-shell">
      <header className="topline">
        <div><p className="eyebrow">OPERATIONS · 90 WORKING DAYS</p><h1>Morning Start</h1><p className="subhead">Bryan <span>·</span> tracking from 22 September 2026</p></div>
        <button className="refresh" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh source"}</button>
      </header>

      {error ? <section className="notice" role="alert"><strong>Tracking data unavailable</strong><p>{error}</p></section> : null}
      {loading && !data && !error ? <p className="loading">Reading the latest source workbooks…</p> : null}
      {data ? <>
        <section className="overview" aria-label="Progress overview">
          <div className="progress-block"><p className="eyebrow">90-DAY PROGRESS</p><div className="big-number">{data.completedDays}<span> / {data.period.workingDays}</span></div><div className="progress-track" role="progressbar" aria-valuenow={data.completionRate} aria-valuemin={0} aria-valuemax={100} aria-label={`${data.completionRate}% of the tracking period completed`}><i style={{ width: `${data.completionRate}%` }} /></div><p className="muted">{data.completionRate}% complete · {data.remainingDays} days remaining</p></div>
          <div className="metric current-role-metric"><p className="eyebrow">TODAY · {today.slice(5)}</p>{todayEvaluation && todayEvaluation.role !== "NOT_ASSIGNED" ? <strong><Role role={todayEvaluation.role} /></strong> : <strong className="muted">{todayEvaluation?.status === "NOT_ASSIGNED" ? "Not assigned" : "No data"}</strong>}<small>{todayEvaluation?.weekday ?? "Today"}</small></div>
          <div className="metric"><p className="eyebrow">MISSED DAYS</p><strong className={data.missedDays ? "danger-text" : ""}>{data.missedDays}</strong></div>
          <div className="metric"><p className="eyebrow">LONGEST STREAK</p><strong>{data.longestStreak}<small> days</small></strong></div>
        </section>

        <section className="section current-week">
          <div className="section-heading"><div><p className="eyebrow">CURRENT WEEK</p><h2>Daily status</h2></div><p className="muted week-legend">Role · status · completed / applicable</p></div>
          {data.currentWeek.length ? <div className="week-list">{data.currentWeek.map((day) => <DayRow key={day.date} day={day} today={day.date === today} onSelect={setSelected} />)}</div> : <p className="muted">No eligible tracking dates this week.</p>}
        </section>

        {selected ? <section className="section detail" aria-live="polite">
          <div className="section-heading"><div><p className="eyebrow">DAY DETAIL</p><h2>{selected.weekday}, {selected.date}</h2></div><button className="text-button" onClick={() => setSelected(null)}>Close</button></div>
          {selected.missedItems.length === 0 && selected.exemptItems.length === 0 ? <p className="muted">No missed or exempt tasks recorded.</p> : null}
          {selected.missedItems.length > 0 ? <div className="detail-group missed-detail"><h3>Missed tasks <span>{selected.missedItems.length}</span></h3>{selected.missedItems.map((task, index) => <div className="task-line" key={`${task.identifier}-${index}`}><strong>{task.identifier}</strong>{task.description ? <span className="task-description">{task.description}</span> : null}<div className="task-meta">{task.server ? <span>Server: {task.server}</span> : null}{task.time ? <span>{task.time}</span> : null}</div>{task.remark ? <p>Remark: {task.remark}</p> : null}</div>)}</div> : null}
          {selected.exemptItems.length > 0 ? <div className="detail-group exempt-detail"><h3>Exempt tasks <span>{selected.exemptItems.length}</span></h3>{selected.exemptItems.map((task, index) => <div className="task-line" key={`${task.identifier}-${index}`}><strong>{task.identifier}</strong>{task.description ? <span className="task-description">{task.description}</span> : null}<div className="task-meta">{task.server ? <span>Server: {task.server}</span> : null}</div><p>Remark: {task.remark}</p></div>)}</div> : null}
        </section> : null}

        <section className="section history-section">
          <div className="section-heading"><div><p className="eyebrow">90-DAY HISTORY</p><h2>Working day record</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th>Date</th><th className="history-weekday">Day</th><th>Role</th><th>Status</th><th>Done</th><th>Missed</th><th>Exempt</th></tr></thead><tbody>{data.history.map((day) => <tr key={day.date} className={day.status === "MISSED" ? "missed-row" : ""}><td><button className="date-link" aria-label={`View details for ${day.weekday}, ${day.date}`} onClick={() => setSelected(day)}>{day.date}</button></td><td className="history-weekday">{day.weekday.slice(0, 3)}</td><td><Role role={day.role} /></td><td><Status day={day} /></td><td>{day.completedTasks}</td><td>{day.missedTasks || "—"}</td><td>{day.exemptTasks || "—"}</td></tr>)}</tbody></table></div>
        </section>

        <section className="section role-summary">
          <div className="section-heading"><div><p className="eyebrow">ROLE SUMMARY</p><h2>Assigned day outcomes</h2></div></div>
          <div className="role-columns"><RoleMetric title="Maker" summary={data.maker} /><RoleMetric title="Checker" summary={data.checker} /></div>
        </section>
      </> : null}
      <footer>Source: operational checklist · Read-only</footer>
    </main>
  );
}

function Role({ role }: { role: DailyEvaluation["role"] }) {
  return role === "NOT_ASSIGNED" ? <span className="muted">—</span> : <span className={`role-label ${role.toLowerCase()}`}>{role}</span>;
}

function Status({ day }: { day: DailyEvaluation }) {
  const statusClass = day.status === "MISSED" ? "status-missed" : day.status === "COMPLETED_WITH_EXCEPTION" ? "status-exempt" : day.status === "NO_DATA" || day.status === "NOT_ASSIGNED" ? "status-no-data" : "";
  const showLate = day.late && (day.status === "COMPLETED" || day.status === "COMPLETED_WITH_EXCEPTION");
  return <span className="status-wrap"><span className={`status ${statusClass}`}>{statusLabel(day)}</span>{showLate ? <span className="late-indicator">LATE</span> : null}</span>;
}

function DayRow({ day, today, onSelect }: { day: DailyEvaluation; today: boolean; onSelect: (day: DailyEvaluation) => void }) {
  const showLate = day.late && (day.status === "COMPLETED" || day.status === "COMPLETED_WITH_EXCEPTION");
  return <button className={`week-row${day.status === "MISSED" ? " week-row-missed" : ""}${today ? " week-row-today" : ""}`} aria-label={`${day.weekday}, ${day.date}, ${day.role}, ${statusLabel(day)}${showLate ? ", late" : ""}, ${weekCount(day)}`} onClick={() => onSelect(day)}><span className="week-date"><b>{day.weekday.slice(0, 3)}</b><small>{day.date.slice(5)}</small>{today ? <span className="today-tag">Today</span> : null}</span><Role role={day.role} /><Status day={day} /><span className="week-count">{weekCount(day)}</span><span className="chevron" aria-hidden="true">›</span></button>;
}

function RoleMetric({ title, summary }: { title: string; summary: TrackingSummary["maker"] }) {
  return <div className="role-metric"><div><span className={`role-label ${title.toLowerCase()}`}>{title.toUpperCase()}</span></div><strong>{summary.successfulDays} <span>/ {summary.assignedDays}</span></strong><p className="muted">successful / assigned · {summary.missedDays} missed · {summary.lateDays} late</p></div>;
}
