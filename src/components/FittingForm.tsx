import { Customer, EyeParams, RULES, Side } from "../types";
import {
  EYE_FIELD_LABEL,
  STATUS_META,
  activeFlags,
  confirmBlock,
  deriveStatus,
  fmt,
  frameCenter,
} from "../rules";

type Patch = (patch: Partial<Customer>) => void;
type PatchEye = (side: Side, key: keyof EyeParams, value: number | null) => void;

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function NumField({
  label,
  unit,
  value,
  step,
  onValue,
  disabled,
  hint,
  danger,
}: {
  label: string;
  unit: string;
  value: number | null;
  step: number;
  onValue: (v: number | null) => void;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <label className={danger ? "field-danger" : ""}>
      <span>
        {label} <em>{unit}</em>
      </span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        disabled={disabled}
        placeholder="待填"
        onChange={(e) => onValue(parseNum(e.target.value))}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

const DISCOMFORT_OPTS = [0, 1, 2, 3, 4, 5];

export default function FittingForm({
  customer,
  patch,
  patchEye,
  onStartAdjust,
  onCancelAdjust,
  onConfirm,
}: {
  customer: Customer;
  patch: Patch;
  patchEye: PatchEye;
  onStartAdjust: () => void;
  onCancelAdjust: () => void;
  onConfirm: (by: string) => void;
}) {
  const status = deriveStatus(customer);
  const flags = activeFlags(customer);
  const block = confirmBlock(customer);
  const center = frameCenter(customer.frameHeight);
  const locked = status === "confirmed";
  const paused = status === "paused";

  const eyes: Side[] = ["OD", "OS"];
  const eyeNames: Record<Side, string> = { OD: "右眼", OS: "左眼" };

  const phDanger = (side: Side): boolean => {
    const ph = customer.eyes[side].fittingHeight;
    return ph !== null && center !== null && Math.abs(ph - center) > RULES.phToleranceMm;
  };
  const addDanger = (side: Side): boolean => {
    const add = customer.eyes[side].add;
    return add !== null && (add < RULES.addMin || add > RULES.addMax);
  };

  return (
    <div className="form-wrap">
      {customer.adjustMode ? (
        <div className="banner banner-adjust">
          <strong>改版进行中</strong>
          <span>
            已确认 v{customer.versions.length} 保持可查；请按医生意见调整参数并重新试戴，确认后另存为 v
            {customer.versions.length + 1}。
          </span>
        </div>
      ) : null}

      {paused ? (
        <div className="banner banner-paused">
          <strong>已暂停 · 不适分 {customer.discomfort} 分</strong>
          <span>
            看远/看近切换不适达到 {RULES.discomfortPause} 分暂停线。请医生填写调整意见，按意见调整参数并重新试戴；
            重新试戴不适分降到 {RULES.discomfortPause} 分以下、且医生已写意见后才能确认。
          </span>
        </div>
      ) : customer.pausedOnce ? (
        <div className="banner banner-review">
          <strong>暂停后待复核</strong>
          <span>
            本顾客试戴中曾出现不适 ≥{RULES.discomfortPause} 分。当前不适 {customer.discomfort} 分已回落，
            但仍须医生填写调整意见（确认调整方向并重试合格）后才能确认。
          </span>
        </div>
      ) : null}

      {status === "review" ? (
        <div className="banner banner-review">
          <strong>待复核 · {flags.length} 项</strong>
          {flags.length > 0 ? (
            <ul>
              {flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : null}
          <span>须由医生填写调整意见后方可确认。</span>
        </div>
      ) : null}

      {/* 基本信息 */}
      <section className="form-section">
        <h3>顾客与镜架</h3>
        <div className="field-grid field-grid-3">
          <label>
            <span>
              顾客姓名 <em>*</em>
            </span>
            <input
              value={customer.name}
              disabled={locked}
              placeholder="首次配渐进镜顾客"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <label>
            <span>联系电话</span>
            <input
              value={customer.phone}
              disabled={locked}
              placeholder="选填"
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </label>
          <NumField
            label="镜架高度"
            unit="mm *"
            value={customer.frameHeight}
            step={1}
            disabled={locked}
            hint={center !== null ? `镜架中心约 ${fmt(center)}mm（自镜架底部起）` : "填写后自动计算镜架中心"}
            onValue={(v) => patch({ frameHeight: v })}
          />
        </div>
      </section>

      {/* 双眼参数 */}
      <section className="form-section">
        <h3>远用处方与配适参数</h3>
        <div className="eyes-grid">
          {eyes.map((side) => (
            <article key={side} className="eye-card">
              <header>
                {eyeNames[side]}
                <span>{side}</span>
              </header>
              <div className="field-grid">
                <NumField
                  label={EYE_FIELD_LABEL.sphere}
                  unit="DS"
                  step={0.25}
                  value={customer.eyes[side].sphere}
                  disabled={locked}
                  hint="负值近视 / 正值远视"
                  onValue={(v) => patchEye(side, "sphere", v)}
                />
                <NumField
                  label={EYE_FIELD_LABEL.cylinder}
                  unit="DC"
                  step={0.25}
                  value={customer.eyes[side].cylinder}
                  disabled={locked}
                  hint="无散光填 0"
                  onValue={(v) => patchEye(side, "cylinder", v)}
                />
                <NumField
                  label={EYE_FIELD_LABEL.axis}
                  unit="°"
                  step={1}
                  value={customer.eyes[side].axis}
                  disabled={locked}
                  hint="1–180"
                  onValue={(v) => patchEye(side, "axis", v)}
                />
                <NumField
                  label={EYE_FIELD_LABEL.add}
                  unit="D"
                  step={0.25}
                  value={customer.eyes[side].add}
                  disabled={locked}
                  danger={addDanger(side)}
                  hint={`允许 ${RULES.addMin.toFixed(2)}–${RULES.addMax.toFixed(2)}，越界待复核`}
                  onValue={(v) => patchEye(side, "add", v)}
                />
                <NumField
                  label={EYE_FIELD_LABEL.fittingHeight}
                  unit="mm"
                  step={1}
                  value={customer.eyes[side].fittingHeight}
                  disabled={locked}
                  danger={phDanger(side)}
                  hint={`自镜架底部起，偏离中心 > ${RULES.phToleranceMm}mm 待复核`}
                  onValue={(v) => patchEye(side, "fittingHeight", v)}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 试戴 */}
      <section className="form-section">
        <h3>试戴记录</h3>
        <div className="trial-row">
          <label className="trial-minutes">
            <span>
              试戴时长 <em>分钟 *</em>
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={customer.trialMinutes ?? ""}
              disabled={locked}
              placeholder="如 20"
              onChange={(e) => patch({ trialMinutes: parseNum(e.target.value) })}
            />
          </label>
          <div className="discomfort-box">
            <span>
              看远 / 看近切换不适分 <em>*（≥{RULES.discomfortPause} 分暂停）</em>
            </span>
            <div className="score-buttons">
              {DISCOMFORT_OPTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={
                    "score" + (customer.discomfort === n ? " active" : "") + (n >= RULES.discomfortPause ? " pause-line" : "")
                  }
                  disabled={locked}
                  onClick={() => patch({ discomfort: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <small>
              0＝无不适，1–3＝可适应，4＝明显不适需暂停，5＝无法适应
            </small>
          </div>
        </div>
      </section>

      {/* 医生意见 */}
      <section className="form-section">
        <h3>医生调整意见</h3>
        <textarea
          value={customer.doctorNote}
          disabled={locked}
          rows={3}
          placeholder={
            flags.length > 0 || paused || customer.pausedOnce
              ? "存在待复核 / 暂停项：医生在此写明调整意见（如调整下加光、上移瞳高、延长适应等），填写后方可确认"
              : "无异常时可留空；出现待复核或暂停项时必须填写"
          }
          onChange={(e) => patch({ doctorNote: e.target.value })}
        />
        {customer.adjustMode ? (
          <label className="reason-field">
            <span>
              改版原因 <em>*</em>
            </span>
            <textarea
              rows={2}
              value={customer.adjustReason}
              placeholder="说明本次为什么改参数另存新版本，如：近用阅读仍模糊，下加光 1.50D 上调至 1.75D"
              onChange={(e) => patch({ adjustReason: e.target.value })}
            />
          </label>
        ) : null}
      </section>

      {/* 操作区 */}
      <footer className="form-footer">
        <div className="footer-status">
          当前状态：
          <span className={`status-badge ${STATUS_META[status].cls}`}>{STATUS_META[status].text}</span>
          {block.canConfirm ? <span className="ok-text">检查通过，可确认</span> : null}
        </div>
        <div className="footer-actions">
          {locked ? (
            <button className="primary-action" onClick={onStartAdjust}>
              改参数另存版本
            </button>
          ) : (
            <>
              {customer.adjustMode ? (
                <button onClick={onCancelAdjust}>放弃改版</button>
              ) : null}
              <button
                className="primary-action"
                disabled={!block.canConfirm}
                title={block.canConfirm ? "" : block.reasons.join("\n")}
                onClick={() => onConfirm("门店验光师")}
              >
                {customer.adjustMode
                  ? `确认并另存 v${customer.versions.length + 1}`
                  : "确认登记"}
              </button>
            </>
          )}
        </div>
      </footer>

      {!block.canConfirm && !locked ? (
        <ul className="block-list">
          {block.reasons.map((r, i) => (
            <li key={i}>⛔ {r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
