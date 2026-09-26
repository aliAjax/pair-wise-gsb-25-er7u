import { Customer, RecordStatus } from "../types";
import { STATUS_META, deriveStatus, frameCenter } from "../rules";

const FILTERS: { key: RecordStatus | "all"; text: string }[] = [
  { key: "all", text: "全部" },
  { key: "review", text: "待复核" },
  { key: "paused", text: "已暂停" },
  { key: "draft", text: "草稿/改版中" },
  { key: "confirmed", text: "已确认" },
];

export default function CustomerList({
  customers,
  selectedId,
  filter,
  counts,
  onFilter,
  onSelect,
  onAdd,
}: {
  customers: Customer[];
  selectedId: string | null;
  filter: RecordStatus | "all";
  counts: Record<RecordStatus, number>;
  onFilter: (f: RecordStatus | "all") => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <aside className="panel side-panel">
      <div className="side-head">
        <h2>顾客</h2>
        <button className="primary-action small" onClick={onAdd}>
          + 新登记
        </button>
      </div>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={"filter-chip" + (filter === f.key ? " active" : "")}
            onClick={() => onFilter(f.key)}
          >
            {f.text}
            <em>{f.key === "all" ? customers.length : counts[f.key as RecordStatus]}</em>
          </button>
        ))}
      </div>

      <div className="customer-list">
        {customers.length === 0 ? (
          <p className="empty-tip">该状态下暂无顾客，点击「新登记」开始试戴记录。</p>
        ) : (
          customers.map((c) => {
            const st = deriveStatus(c);
            const center = frameCenter(c.frameHeight);
            return (
              <button
                key={c.id}
                className={"customer-card" + (c.id === selectedId ? " selected" : "")}
                onClick={() => onSelect(c.id)}
              >
                <div className="cc-top">
                  <strong>{c.name || "未命名顾客"}</strong>
                  <span className={`status-badge ${STATUS_META[st].cls}`}>{STATUS_META[st].text}</span>
                </div>
                <p>
                  {c.phone || "未留电话"} · 镜架{c.frameHeight ?? "?"}mm
                  {center !== null ? `/中心${center}mm` : ""}
                </p>
                <p className="cc-sub">
                  {c.versions.length > 0 ? `已确认 v${c.versions.length} · ` : ""}
                  {c.trialMinutes !== null ? `试戴 ${c.trialMinutes} 分钟 · ` : "未试戴 · "}
                  不适 {c.discomfort ?? "—"} 分
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
