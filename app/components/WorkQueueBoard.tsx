"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { formatRecallDueDate } from "@/lib/data/recallWorkflow";
import { formatActivityTimestamp } from "@/lib/data/opportunityActivityDisplay";
import {
  WORK_QUEUE_TABS,
  WORK_QUEUE_TYPES,
  formatEstimatedAmount,
  formatQueueLastActivity,
  isClinicallyOverdue,
  queueStatusLabel,
  selectWorkQueueItems,
  type WorkQueueItem,
  type WorkQueueTab,
  type WorkQueueType,
} from "@/lib/data/workQueue";

type Props = {
  items: WorkQueueItem[];
  hrefFor: (item: WorkQueueItem) => string;
  showType?: boolean;
  enableTypeFilter?: boolean;
  ctaLabel?: string;
};

const TAB_LABELS: Record<WorkQueueTab, string> = {
  today: "Today",
  scheduled: "Scheduled",
  snoozed: "Snoozed",
};

const EMPTY_COPY: Record<WorkQueueTab, string> = {
  today: "Nothing needs attention today.",
  scheduled: "No scheduled opportunities in this queue.",
  snoozed: "No snoozed opportunities.",
};

function dueCopy(item: WorkQueueItem): string | null {
  if (item.opportunityType === "Recall" && item.dueDate) {
    const due = formatRecallDueDate(item.dueDate);
    if (due === "Not available") {
      return isClinicallyOverdue(item) ? "Overdue" : null;
    }
    return isClinicallyOverdue(item) ? `Overdue · due ${due}` : `Due ${due}`;
  }

  if (item.opportunityType === "Claim" && isClinicallyOverdue(item)) {
    return "Aging 30+ days";
  }

  return null;
}

function priorityColor(priority: string): { background: string; color: string } {
  if (priority === "High") {
    return { background: "#fee2e2", color: "#b91c1c" };
  }
  if (priority === "Medium") {
    return { background: "#fef3c7", color: "#92400e" };
  }
  return { background: "#dcfce7", color: "#15803d" };
}

export default function WorkQueueBoard({
  items,
  hrefFor,
  showType = false,
  enableTypeFilter = false,
  ctaLabel = "Review →",
}: Props) {
  const [tab, setTab] = useState<WorkQueueTab>("today");
  const [typeFilter, setTypeFilter] = useState<WorkQueueType | "all">("all");

  const visible = useMemo(
    () => selectWorkQueueItems(items, tab, new Date(), typeFilter),
    [items, tab, typeFilter]
  );

  const tabCounts = useMemo(() => {
    return Object.fromEntries(
      WORK_QUEUE_TABS.map((name) => [
        name,
        selectWorkQueueItems(items, name, new Date(), typeFilter).length,
      ])
    ) as Record<WorkQueueTab, number>;
  }, [items, typeFilter]);

  const estimatedTotal = visible.reduce(
    (sum, item) => sum + Number(item.estimatedValue ?? 0),
    0
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {WORK_QUEUE_TABS.map((name) => {
          const active = tab === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              style={{
                border: active ? "none" : "1px solid #e2e8f0",
                background: active ? "#2563eb" : "white",
                color: active ? "white" : "#0f172a",
                borderRadius: 999,
                padding: "10px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {TAB_LABELS[name]} ({tabCounts[name]})
            </button>
          );
        })}
      </div>

      {enableTypeFilter ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            style={typeButtonStyle(typeFilter === "all")}
          >
            All types
          </button>
          {WORK_QUEUE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              style={typeButtonStyle(typeFilter === type)}
            >
              {type}
            </button>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Kpi title="In this view" value={String(visible.length)} />
        <Kpi title="Estimated" value={formatEstimatedAmount(estimatedTotal)} />
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            background: "white",
            padding: 24,
            borderRadius: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          }}
        >
          <p>{EMPTY_COPY[tab]}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,.08)] md:block">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#2563eb", color: "white" }}>
                <tr>
                  <HeaderCell>Patient</HeaderCell>
                  {showType ? <HeaderCell>Type</HeaderCell> : null}
                  <HeaderCell>Reason</HeaderCell>
                  <HeaderCell>Estimated</HeaderCell>
                  <HeaderCell>Priority</HeaderCell>
                  <HeaderCell>Status</HeaderCell>
                  <HeaderCell>Due</HeaderCell>
                  <HeaderCell>Last activity</HeaderCell>
                  {tab === "snoozed" ? <HeaderCell>Snoozed until</HeaderCell> : null}
                  <HeaderCell>Action</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <BodyCell>
                      <strong>{item.patient}</strong>
                    </BodyCell>
                    {showType ? <BodyCell>{item.opportunityType}</BodyCell> : null}
                    <BodyCell>{item.reason ?? "—"}</BodyCell>
                    <BodyCell>
                      <span style={{ color: "#15803d", fontWeight: 700 }}>
                        {formatEstimatedAmount(item.estimatedValue)}
                      </span>
                    </BodyCell>
                    <BodyCell>
                      <PriorityBadge priority={item.priority} />
                    </BodyCell>
                    <BodyCell>{queueStatusLabel(item.workflowStatus)}</BodyCell>
                    <BodyCell>
                      <DueBadge item={item} />
                    </BodyCell>
                    <BodyCell>{formatQueueLastActivity(item) ?? "—"}</BodyCell>
                    {tab === "snoozed" ? (
                      <BodyCell>
                        {item.snoozedUntil
                          ? formatActivityTimestamp(item.snoozedUntil)
                          : "—"}
                      </BodyCell>
                    ) : null}
                    <BodyCell>
                      <Link href={hrefFor(item)}>
                        <button type="button" style={ctaStyle}>
                          {ctaLabel}
                        </button>
                      </Link>
                    </BodyCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {visible.map((item) => (
              <article
                key={item.id}
                style={{
                  background: "white",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{item.patient}</h3>
                    {showType ? (
                      <p style={{ margin: "4px 0 0", color: "#64748b" }}>
                        {item.opportunityType}
                      </p>
                    ) : null}
                  </div>
                  <PriorityBadge priority={item.priority} />
                </div>
                <p style={{ marginTop: 12 }}>{item.reason ?? "—"}</p>
                <p style={{ marginTop: 8, fontWeight: 700, color: "#15803d" }}>
                  Estimated {formatEstimatedAmount(item.estimatedValue)}
                </p>
                <p style={{ marginTop: 8 }}>
                  Status: {queueStatusLabel(item.workflowStatus)}
                </p>
                <DueBadge item={item} />
                {formatQueueLastActivity(item) ? (
                  <p style={{ marginTop: 8, color: "#64748b" }}>
                    {formatQueueLastActivity(item)}
                  </p>
                ) : null}
                {tab === "snoozed" && item.snoozedUntil ? (
                  <p style={{ marginTop: 8, color: "#64748b" }}>
                    Snoozed until {formatActivityTimestamp(item.snoozedUntil)}
                  </p>
                ) : null}
                <Link href={hrefFor(item)}>
                  <button
                    type="button"
                    style={{ ...ctaStyle, width: "100%", marginTop: 16 }}
                  >
                    {ctaLabel}
                  </button>
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 2px 10px rgba(0,0,0,.08)",
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>
      <h2 style={{ margin: "8px 0 0" }}>{value}</h2>
    </div>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <th style={{ padding: 16, textAlign: "left", whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td style={{ padding: 16, verticalAlign: "top" }}>{children}</td>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = priorityColor(priority);
  return (
    <span
      style={{
        background: colors.background,
        color: colors.color,
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 700,
        display: "inline-block",
      }}
    >
      {priority}
    </span>
  );
}

function DueBadge({ item }: { item: WorkQueueItem }) {
  const copy = dueCopy(item);
  if (!copy) {
    return <span>—</span>;
  }

  const overdue = isClinicallyOverdue(item);
  return (
    <span
      style={{
        background: overdue ? "#fee2e2" : "#f1f5f9",
        color: overdue ? "#b91c1c" : "#334155",
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 700,
        display: "inline-block",
        marginTop: 8,
      }}
    >
      {copy}
    </span>
  );
}

function typeButtonStyle(active: boolean): CSSProperties {
  return {
    border: active ? "none" : "1px solid #e2e8f0",
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

const ctaStyle: CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  cursor: "pointer",
  fontWeight: 700,
};
