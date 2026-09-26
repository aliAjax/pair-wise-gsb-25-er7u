import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const STORAGE_KEY = "hxwl-11-progressive-trials";

// 复核规则阈值
const ADD_MIN = 0.75;
const ADD_MAX = 3.0;
const PUPIL_HEIGHT_TOLERANCE = 4; // mm，瞳高允许偏离镜架中心的最大值
const DISCOMFORT_PAUSE = 4; // 不适分达到该值即暂停

type Status = "draft" | "pending" | "confirmed";

interface EyeParams {
  sphere: string; // 远用球镜
  cylinder: string; // 远用柱镜
  axis: string; // 轴位
  add: string; // 下加光
  pupilHeight: string; // 瞳高 mm
}

interface TrialCore {
  frameCenterHeight: string; // 镜架中心高度 mm
  trialMinutes: string; // 试戴时长 分钟
  discomfort: number; // 看远看近切换不适分 0-5
  doctorNote: string; // 医生调整意见
  right: EyeParams;
  left: EyeParams;
}

interface VersionSnapshot extends TrialCore {
  version: number;
  savedAt: string;
  reviewReasons: string[];
}

interface TrialRecord extends TrialCore {
  id: string;
  customer: string;
  status: Status;
  version: number;
  changeReason: string; // 当前版本的修改原因
  reviewReasons: string[];
  createdAt: string;
  updatedAt: string;
  versions: VersionSnapshot[];
}

const emptyEye = (): EyeParams => ({
  sphere: "",
  cylinder: "",
  axis: "",
  add: "",
  pupilHeight: "",
});

function computeReviewReasons(core: TrialCore): string[] {
  const reasons: string[] = [];
  const center = parseFloat(core.frameCenterHeight);
  const hasCenter = core.frameCenterHeight.trim() !== "" && !Number.isNaN(center);

  (["right", "left"] as const).forEach((side) => {
    const eye = core[side];
    const label = side === "right" ? "右眼" : "左眼";

    const add = parseFloat(eye.add);
    if (eye.add.trim() !== "" && !Number.isNaN(add) && (add < ADD_MIN || add > ADD_MAX)) {
      reasons.push(
        `${label}下加光 ${add.toFixed(2)}D 越过 ${ADD_MIN.toFixed(2)}–${ADD_MAX.toFixed(2)}D 区间`
      );
    }

    const ph = parseFloat(eye.pupilHeight);
    if (eye.pupilHeight.trim() !== "" && !Number.isNaN(ph) && hasCenter) {
      const diff = ph - center;
      if (Math.abs(diff) > PUPIL_HEIGHT_TOLERANCE) {
        reasons.push(
          `${label}瞳高偏离镜架中心 ${diff > 0 ? "+" : ""}${diff.toFixed(1)}mm，超过 ${PUPIL_HEIGHT_TOLERANCE}mm`
        );
      }
    }
  });

  if (core.discomfort >= DISCOMFORT_PAUSE) {
    reasons.push(`看远看近切换不适 ${core.discomfort} 分，达到 ${DISCOMFORT_PAUSE} 分暂停线`);
  }
  return reasons;
}

function snapshotOf(rec: TrialRecord): VersionSnapshot {
  return {
    version: rec.version,
    savedAt: rec.updatedAt,
    frameCenterHeight: rec.frameCenterHeight,
    trialMinutes: rec.trialMinutes,
    discomfort: rec.discomfort,
    doctorNote: rec.doctorNote,
    right: { ...rec.right },
    left: { ...rec.left },
    reviewReasons: [...rec.reviewReasons],
  };
}

function newRecord(): TrialRecord {
  const now = new Date().toISOString();
  return {
    id: `T${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    customer: "",
    status: "draft",
    version: 1,
    changeReason: "",
    reviewReasons: [],
    createdAt: now,
    updatedAt: now,
    versions: [],
    frameCenterHeight: "",
    trialMinutes: "",
    discomfort: 0,
    doctorNote: "",
    right: emptyEye(),
    left: emptyEye(),
  };
}

function seedRecords(): TrialRecord[] {
  const now = new Date().toISOString();

  // 待复核示例：下加光越界 + 瞳高偏离 + 不适达暂停线
  const pending: TrialRecord = {
    id: "seed-pending",
    customer: "王秀兰（首配渐进）",
    status: "pending",
    version: 1,
    changeReason: "",
    frameCenterHeight: "20",
    trialMinutes: "15",
    discomfort: 4,
    doctorNote: "",
    right: { sphere: "-1.00", cylinder: "-0.50", axis: "175", add: "+3.50", pupilHeight: "25" },
    left: { sphere: "-1.25", cylinder: "-0.25", axis: "10", add: "+3.50", pupilHeight: "24.5" },
    reviewReasons: [],
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  pending.reviewReasons = computeReviewReasons(pending);

  // 已确认示例：带一条历史版本
  const confirmedV1: TrialRecord = {
    id: "seed-confirmed",
    customer: "李建国（首配渐进）",
    status: "confirmed",
    version: 1,
    changeReason: "",
    frameCenterHeight: "21",
    trialMinutes: "20",
    discomfort: 1,
    doctorNote: "参数在免复核范围内，可直接确认",
    right: { sphere: "-2.00", cylinder: "-0.75", axis: "180", add: "+1.50", pupilHeight: "21.5" },
    left: { sphere: "-2.25", cylinder: "-0.50", axis: "175", add: "+1.50", pupilHeight: "21" },
    reviewReasons: [],
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  const confirmedV2: TrialRecord = {
    ...confirmedV1,
    version: 2,
    changeReason: "试戴后近用稍吃力，下加光微调至 +1.75",
    trialMinutes: "25",
    doctorNote: "下加光由 +1.50 调整至 +1.75，瞳高复核无误",
    right: { ...confirmedV1.right, add: "+1.75" },
    left: { ...confirmedV1.left, add: "+1.75" },
    versions: [snapshotOf(confirmedV1)],
  };
  return [pending, confirmedV2];
}

function loadRecords(): TrialRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 本地数据损坏时回退到示例数据
  }
  return seedRecords();
}

const statusMeta: Record<Status, { label: string; className: string }> = {
  draft: { label: "登记中", className: "badge badge-draft" },
  pending: { label: "待复核", className: "badge badge-pending" },
  confirmed: { label: "已确认", className: "badge badge-confirmed" },
};

function statusLabel(rec: TrialRecord): string {
  const base = statusMeta[rec.status].label;
  if (rec.status === "pending" && rec.discomfort >= DISCOMFORT_PAUSE) return `${base} · 已暂停`;
  return base;
}

function eyeSummary(label: string, e: EyeParams): string {
  return `${label} ${e.sphere || "—"} / ${e.cylinder || "—"} × ${e.axis || "—"}° · ADD ${e.add || "—"} · 瞳高 ${e.pupilHeight || "—"}mm`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

const discomfortOptions = [
  "0 无不适",
  "1 轻微，可忽略",
  "2 明显，可适应",
  "3 难受，需休息",
  "4 严重，需暂停",
  "5 无法耐受",
];

function MetricCard({ label, value, index }: { label: string; value: number; index: number }) {
  const colors = ["status-ok", "status-watch", "status-danger", "status-ok"];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={colors[index % colors.length]} />
    </article>
  );
}

function EyeRow({
  label,
  eye,
  onChange,
}: {
  label: string;
  eye: EyeParams;
  onChange: (next: EyeParams) => void;
}) {
  const set = (key: keyof EyeParams) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...eye, [key]: e.target.value });
  return (
    <tr>
      <th scope="row">{label}</th>
      <td><input value={eye.sphere} onChange={set("sphere")} placeholder="-2.75" /></td>
      <td><input value={eye.cylinder} onChange={set("cylinder")} placeholder="-0.50" /></td>
      <td><input value={eye.axis} onChange={set("axis")} placeholder="180" inputMode="numeric" /></td>
      <td><input value={eye.add} onChange={set("add")} placeholder="+1.50" /></td>
      <td><input value={eye.pupilHeight} onChange={set("pupilHeight")} placeholder="21.0" inputMode="decimal" /></td>
    </tr>
  );
}

function App() {
  const [initial] = useState(() => {
    const loaded = loadRecords();
    return { records: loaded, form: loaded[0] ?? newRecord() };
  });
  const [records, setRecords] = useState<TrialRecord[]>(initial.records);
  const [form, setForm] = useState<TrialRecord>(initial.form);
  const [versionReason, setVersionReason] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const saved = records.find((r) => r.id === form.id);
  const isNew = !saved;
  const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(form);
  const liveReasons = useMemo(() => computeReviewReasons(form), [form]);
  const canConfirm = liveReasons.length === 0 || form.doctorNote.trim() !== "";
  const lockedAsConfirmed = saved?.status === "confirmed";

  const sortedRecords = useMemo(() => {
    const rank: Record<Status, number> = { pending: 0, draft: 1, confirmed: 2 };
    return [...records].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [records]);

  const pendingCount = records.filter((r) => r.status === "pending").length;
  const confirmedCount = records.filter((r) => r.status === "confirmed").length;
  const versionCount = records.reduce((sum, r) => sum + r.versions.length, 0);

  function upsert(next: TrialRecord) {
    setRecords((prev) =>
      prev.some((r) => r.id === next.id) ? prev.map((r) => (r.id === next.id ? next : r)) : [next, ...prev]
    );
    setForm(next);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function handleSelect(rec: TrialRecord) {
    setForm(JSON.parse(JSON.stringify(rec)) as TrialRecord);
    setVersionReason("");
  }

  function handleNew() {
    setForm(newRecord());
    setVersionReason("");
  }

  function handleSave() {
    if (!form.customer.trim()) {
      flash("请先填写顾客姓名/编号");
      return;
    }
    if (lockedAsConfirmed && dirty) {
      flash("已确认记录请走「另存为新版本」");
      return;
    }
    const reasons = computeReviewReasons(form);
    upsert({
      ...form,
      reviewReasons: reasons,
      status: reasons.length > 0 ? "pending" : form.status === "confirmed" ? "confirmed" : "draft",
      updatedAt: new Date().toISOString(),
    });
    flash(reasons.length > 0 ? "已保存，存在复核项，等待医生意见" : "登记已保存");
  }

  function handleConfirm() {
    if (!canConfirm || form.status === "confirmed") return;
    const reasons = computeReviewReasons(form);
    upsert({
      ...form,
      reviewReasons: reasons,
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    });
    flash("已确认，后续改参数需另存新版本并填写原因");
  }

  function handleSaveVersion() {
    if (!saved || saved.status !== "confirmed") return;
    if (!versionReason.trim()) {
      flash("另存新版本前请填写修改原因");
      return;
    }
    const reasons = computeReviewReasons(form);
    upsert({
      ...form,
      version: saved.version + 1,
      changeReason: versionReason.trim(),
      versions: [...saved.versions, snapshotOf(saved)],
      reviewReasons: reasons,
      status: reasons.length > 0 ? "pending" : "draft",
      updatedAt: new Date().toISOString(),
    });
    setVersionReason("");
    flash(`已另存为 v${saved.version + 1}，旧版本已归档可查`);
  }

  function handleReset() {
    if (saved) setForm(JSON.parse(JSON.stringify(saved)) as TrialRecord);
    else setForm(newRecord());
    setVersionReason("");
  }

  const meta = statusMeta[form.status];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-11 · 眼视光 · 首配渐进</p>
          <h1>渐进镜试戴登记台</h1>
          <p className="subtitle">
            登记左右眼远用球镜 / 柱镜 / 轴位、下加光、瞳高与试戴时长，记录看远看近切换的不适分；
            触发复核规则的记录须医生写下调整意见后才能确认，确认后的每次改动另存版本并留痕。
          </p>
        </div>
        <div className="stack-card">
          <span>复核规则</span>
          <strong>
            下加光 {ADD_MIN.toFixed(2)}–{ADD_MAX.toFixed(2)}D
            <br />
            瞳高偏离镜架中心 ≤ {PUPIL_HEIGHT_TOLERANCE}mm
            <br />
            不适分 ≥ {DISCOMFORT_PAUSE} 暂停
          </strong>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="在册顾客" value={records.length} index={0} />
        <MetricCard label="待复核 / 暂停" value={pendingCount} index={1} />
        <MetricCard label="已确认" value={confirmedCount} index={2} />
        <MetricCard label="历史版本" value={versionCount} index={3} />
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <div className="section-heading">
            <h2>顾客</h2>
            <button className="primary-action" onClick={handleNew}>新增登记</button>
          </div>
          <div className="customer-list">
            {sortedRecords.map((rec) => (
              <button
                key={rec.id}
                className={`customer-item${rec.id === form.id ? " active" : ""}`}
                onClick={() => handleSelect(rec)}
              >
                <span className="customer-name">{rec.customer || "（未命名）"}</span>
                <span className="customer-meta">
                  <span className={statusMeta[rec.status].className}>{statusLabel(rec)}</span>
                  <span className="customer-version">v{rec.version}</span>
                </span>
                {rec.reviewReasons.length > 0 && (
                  <span className="customer-reasons">{rec.reviewReasons[0]}</span>
                )}
              </button>
            ))}
            {sortedRecords.length === 0 && <p className="empty-hint">暂无登记，点击「新增登记」开始。</p>}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>试戴登记</p>
              <h2>
                {isNew ? "新顾客登记" : form.customer}
                <span className={meta.className} style={{ marginLeft: 10 }}>{statusLabel(form)}</span>
                <span className="customer-version" style={{ marginLeft: 8 }}>v{form.version}</span>
              </h2>
            </div>
            {dirty && <button onClick={handleReset}>放弃修改</button>}
          </div>

          {notice && <p className="notice">{notice}</p>}

          <div className="field-grid">
            <label>
              <span>顾客姓名 / 编号</span>
              <input
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                placeholder="如：王秀兰 / Patient-081"
              />
            </label>
            <label>
              <span>镜架中心高度（mm）</span>
              <input
                value={form.frameCenterHeight}
                onChange={(e) => setForm({ ...form, frameCenterHeight: e.target.value })}
                placeholder="镜架几何中心，如 20"
                inputMode="decimal"
              />
            </label>
            <label>
              <span>试戴时长（分钟）</span>
              <input
                value={form.trialMinutes}
                onChange={(e) => setForm({ ...form, trialMinutes: e.target.value })}
                placeholder="如 15"
                inputMode="numeric"
              />
            </label>
            <label>
              <span>看远看近切换不适分（≥{DISCOMFORT_PAUSE} 暂停）</span>
              <select
                value={form.discomfort}
                onChange={(e) => setForm({ ...form, discomfort: Number(e.target.value) })}
              >
                {discomfortOptions.map((text, i) => (
                  <option key={text} value={i}>{text}</option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="sub-heading">双眼远用参数与下加光</h3>
          <div className="eye-table-wrap">
            <table className="eye-table">
              <thead>
                <tr>
                  <th>眼别</th>
                  <th>球镜 DS</th>
                  <th>柱镜 DC</th>
                  <th>轴位 °</th>
                  <th>下加光 ADD</th>
                  <th>瞳高 mm</th>
                </tr>
              </thead>
              <tbody>
                <EyeRow label="右眼" eye={form.right} onChange={(right) => setForm({ ...form, right })} />
                <EyeRow label="左眼" eye={form.left} onChange={(left) => setForm({ ...form, left })} />
              </tbody>
            </table>
          </div>

          {liveReasons.length > 0 ? (
            <div className="warning-box">
              <strong>触发复核，须医生调整意见后方可确认：</strong>
              <ul>
                {liveReasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          ) : (
            <div className="ok-box">当前参数在免复核范围内，保存后可直接确认。</div>
          )}

          <label className="doctor-note">
            <span>医生调整意见{liveReasons.length > 0 ? "（触发复核，必填）" : "（选填）"}</span>
            <textarea
              value={form.doctorNote}
              onChange={(e) => setForm({ ...form, doctorNote: e.target.value })}
              placeholder="如：下加光降至 +2.50，瞳高按镜架中心 +2mm 重新点瞳，一周后复查"
              rows={3}
            />
          </label>

          <div className="action-bar">
            {!(lockedAsConfirmed && dirty) && (
              <button className="primary-action" onClick={handleSave} disabled={!dirty}>
                保存登记
              </button>
            )}
            <button
              className="confirm-action"
              onClick={handleConfirm}
              disabled={form.status === "confirmed" || !canConfirm || (dirty && !lockedAsConfirmed)}
              title={
                form.status === "confirmed"
                  ? "已确认"
                  : !canConfirm
                    ? "存在复核项，需先填写医生调整意见"
                    : dirty
                      ? "请先保存登记"
                      : "确认当前登记"
              }
            >
              确认
            </button>
          </div>

          {lockedAsConfirmed && (
            <div className="version-bar">
              <span>已确认记录：修改参数后另存新版本，旧版本自动归档。</span>
              <input
                value={versionReason}
                onChange={(e) => setVersionReason(e.target.value)}
                placeholder="修改原因（必填），如：试戴后看近吃力，微调下加光"
              />
              <button className="primary-action" onClick={handleSaveVersion} disabled={!dirty}>
                另存为新版本
              </button>
            </div>
          )}
          {form.changeReason && (
            <p className="change-reason">本版修改原因：{form.changeReason}</p>
          )}
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>留痕</p>
            <h2>版本历史（{form.customer || "未选择顾客"}）</h2>
          </div>
          <span className="customer-version">当前 v{form.version} · 更新于 {fmtTime(form.updatedAt)}</span>
        </div>
        {form.versions.length === 0 ? (
          <p className="empty-hint">暂无历史版本。确认后再次修改参数并「另存为新版本」，旧记录会归档在这里。</p>
        ) : (
          <div className="record-list">
            {[...form.versions].reverse().map((v) => (
              <article key={v.version} className="record-card version-card">
                <div className="record-index">v{v.version}</div>
                <div>
                  <h3>保存于 {fmtTime(v.savedAt)}</h3>
                  <p>{eyeSummary("右眼", v.right)}</p>
                  <p>{eyeSummary("左眼", v.left)}</p>
                  <p>
                    镜架中心 {v.frameCenterHeight || "—"}mm · 试戴 {v.trialMinutes || "—"} 分钟 · 不适 {v.discomfort} 分
                  </p>
                  {v.doctorNote && <p>医生意见：{v.doctorNote}</p>}
                  {v.reviewReasons.length > 0 && (
                    <p className="version-reasons">当时复核项：{v.reviewReasons.join("；")}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
