import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { AppState, Customer, EyeParams, RecordStatus, Side } from "./types";
import { loadState, newCustomer, saveState } from "./storage";
import { buildVersion, confirmBlock, deriveStatus } from "./rules";
import CustomerList from "./components/CustomerList";
import FittingForm from "./components/FittingForm";
import VersionHistory from "./components/VersionHistory";

const initialState = loadState();

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialState.customers[0]?.id ?? null
  );
  const [filter, setFilter] = useState<RecordStatus | "all">("all");
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const customers = state.customers;
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const base: Record<RecordStatus, number> = { draft: 0, review: 0, paused: 0, confirmed: 0 };
    customers.forEach((c) => {
      base[deriveStatus(c)] += 1;
    });
    return base;
  }, [customers]);

  const visibleCustomers = useMemo(() => {
    const list = [...customers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return filter === "all" ? list : list.filter((c) => deriveStatus(c) === filter);
  }, [customers, filter]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  }

  function updateCustomer(id: string, mut: (c: Customer) => Customer) {
    setState((s) => ({
      ...s,
      customers: s.customers.map((c) =>
        c.id === id ? { ...mut(c), updatedAt: new Date().toISOString() } : c
      ),
    }));
  }

  const patch = (p: Partial<Customer>) => {
    if (!selected) return;
    // 不适分达到暂停线时置粘性标记，改低也需医生意见放行
    if (
      typeof p.discomfort === "number" &&
      p.discomfort >= 4
    ) {
      p = { ...p, pausedOnce: true };
    }
    updateCustomer(selected.id, (c) => ({ ...c, ...p }));
  };

  const patchEye = (side: Side, key: keyof EyeParams, value: number | null) => {
    if (!selected) return;
    updateCustomer(selected.id, (c) => ({
      ...c,
      eyes: { ...c.eyes, [side]: { ...c.eyes[side], [key]: value } },
    }));
  };

  function addCustomer() {
    const c = newCustomer();
    setState((s) => ({ ...s, customers: [c, ...s.customers] }));
    setSelectedId(c.id);
    setFilter("all");
  }

  function startAdjust() {
    if (!selected) return;
    updateCustomer(selected.id, (c) => ({
      ...c,
      adjustMode: true,
      adjustReason: "",
      // 新一轮试戴：清空旧试戴结果与暂停标记，要求重新试戴评分
      trialMinutes: null,
      discomfort: null,
      pausedOnce: false,
      doctorNote: "",
    }));
    flash("已进入改版：参数可编辑，调整并重新试戴后另存新版本，v" + selected.versions.length + " 保留可查");
  }

  function cancelAdjust() {
    if (!selected) return;
    // 放弃改版：恢复到最新已确认版本
    updateCustomer(selected.id, (c) => {
      const last = c.versions[c.versions.length - 1];
      return {
        ...c,
        adjustMode: false,
        adjustReason: "",
        pausedOnce: last.discomfort >= 4,
        eyes: JSON.parse(JSON.stringify(last.eyes)) as Customer["eyes"],
        trialMinutes: last.trialMinutes,
        discomfort: last.discomfort,
        doctorNote: last.doctorNote,
      };
    });
  }

  function confirm(by: string) {
    if (!selected) return;
    const block = confirmBlock(selected);
    if (!block.canConfirm) {
      flash(block.reasons[0] ?? "暂不能确认");
      return;
    }
    updateCustomer(selected.id, (c) => {
      const v = buildVersion(c, by);
      return {
        ...c,
        versions: [...c.versions, v],
        adjustMode: false,
        adjustReason: "",
        pausedOnce: false,
      };
    });
    const nextVersion = selected.versions.length + 1;
    flash(nextVersion === 1 ? "已确认，v1 参数已存档" : `已另存为 v${nextVersion}，旧版本保留可查`);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-11 · 渐进多焦点试戴登记台</p>
          <h1>老花渐进镜 · 试戴登记台</h1>
          <p className="subtitle">
            首次配渐进镜顾客专用：双眼远用球镜/柱镜/轴位、下加光、镜架瞳高与试戴时长逐项登记，
            记录看远看近切换不适分。参数越界或不适超标先拦截复核，医生意见放行；确认后改参数另存版本，
            数据本地保存，关掉页面再开仍在。
          </p>
        </div>
        <div className="stack-card">
          <span>待复核 / 暂停 / 已确认</span>
          <strong>
            {counts.review} 项待复核 · {counts.paused} 项暂停 · {counts.confirmed} 人已确认
          </strong>
          <span className="rule-hint">
            ADD 0.75–3.00D · 瞳高偏离镜架中心 ≤4mm · 不适分 ≥4 暂停
          </span>
        </div>
      </section>

      <section className="workspace">
        <CustomerList
          customers={visibleCustomers}
          selectedId={selectedId}
          filter={filter}
          counts={counts}
          onFilter={setFilter}
          onSelect={setSelectedId}
          onAdd={addCustomer}
        />

        <section className="panel detail-panel">
          {selected ? (
            <>
              <div className="detail-head">
                <div>
                  <p className="eyebrow">{selected.adjustMode ? "改版另存" : "试戴登记"}</p>
                  <h2>{selected.name || "未命名顾客"}</h2>
                </div>
              </div>
              <FittingForm
                customer={selected}
                patch={patch}
                patchEye={patchEye}
                onStartAdjust={startAdjust}
                onCancelAdjust={cancelAdjust}
                onConfirm={confirm}
              />
            </>
          ) : (
            <p className="empty-tip">请选择或新建一位顾客。</p>
          )}
        </section>
      </section>

      {selected ? (
        <section className="panel records">
          <div className="section-heading">
            <div>
              <p className="eyebrow">历史版本</p>
              <h2>确认档案（旧记录可查）</h2>
            </div>
            <span className="version-count">共 {selected.versions.length} 个版本</span>
          </div>
          <VersionHistory customer={selected} />
        </section>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
