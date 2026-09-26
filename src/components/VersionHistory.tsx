import { Customer, EyeParams, FittingVersion, Side } from "../types";
import { clockText, fmt, signed } from "../rules";

function eyeSummary(eye: EyeParams): string {
  const cyl = eye.cylinder === 0 ? "平光" : `${signed(eye.cylinder)}/${fmt(eye.axis)}°`;
  return `${signed(eye.sphere)}DS ${cyl} · ADD ${fmt(eye.add)}D · 瞳高 ${fmt(eye.fittingHeight)}mm`;
}

function ParamRow({ label, cur, prev }: { label: string; cur: string; prev?: string }) {
  const changed = prev !== undefined && cur !== prev;
  return (
    <div className={"vparam" + (changed ? " changed" : "")}>
      <span>{label}</span>
      <strong>{cur}</strong>
      {changed ? <small>原 {prev}</small> : null}
    </div>
  );
}

function VersionCard({ v, prev }: { v: FittingVersion; prev?: FittingVersion }) {
  const sides: Side[] = ["OD", "OS"];
  const names: Record<Side, string> = { OD: "右眼", OS: "左眼" };

  return (
    <article className={"version-card" + (prev ? "" : " version-first")}>
      <header>
        <div className="version-tag">v{v.version}</div>
        <div className="version-meta">
          <strong>{v.reason || "—"}</strong>
          <span>
            {clockText(v.confirmedAt)} · 确认人 {v.confirmedBy} · 试戴 {v.trialMinutes} 分钟 · 不适 {v.discomfort} 分
          </span>
        </div>
      </header>
      <div className="version-eyes">
        {sides.map((side) => (
          <div key={side} className="version-eye">
            <h4>
              {names[side]} <em>{eyeSummary(v.eyes[side])}</em>
            </h4>
            <div className="vparam-grid">
              <ParamRow
                label="远用球镜"
                cur={`${signed(v.eyes[side].sphere)} DS`}
                prev={prev ? `${signed(prev.eyes[side].sphere)} DS` : undefined}
              />
              <ParamRow
                label="远用柱镜"
                cur={v.eyes[side].cylinder === 0 ? "平光" : `${signed(v.eyes[side].cylinder)} DC`}
                prev={
                  prev
                    ? prev.eyes[side].cylinder === 0
                      ? "平光"
                      : `${signed(prev.eyes[side].cylinder)} DC`
                    : undefined
                }
              />
              <ParamRow
                label="轴位"
                cur={`${fmt(v.eyes[side].axis)}°`}
                prev={prev ? `${fmt(prev.eyes[side].axis)}°` : undefined}
              />
              <ParamRow
                label="下加光"
                cur={`${fmt(v.eyes[side].add)} D`}
                prev={prev ? `${fmt(prev.eyes[side].add)} D` : undefined}
              />
              <ParamRow
                label="瞳高"
                cur={`${fmt(v.eyes[side].fittingHeight)} mm`}
                prev={prev ? `${fmt(prev.eyes[side].fittingHeight)} mm` : undefined}
              />
            </div>
          </div>
        ))}
      </div>
      {v.doctorNote ? (
        <p className="version-note">
          <b>医生意见：</b>
          {v.doctorNote}
        </p>
      ) : null}
      {v.flags.length > 0 ? (
        <p className="version-flags">确认时残留提示：{v.flags.join("；")}（医生已签字放行）</p>
      ) : null}
    </article>
  );
}

export default function VersionHistory({ customer }: { customer: Customer }) {
  const versions = [...customer.versions].reverse();
  if (versions.length === 0) {
    return (
      <div className="version-empty">
        尚无确认版本。参数检查通过并确认后，此处保存 v1 快照；之后改参数会另存新版本，旧记录始终可查。
      </div>
    );
  }
  return (
    <div className="version-list">
      {versions.map((v, i) => {
        // 已按时间倒序，i 位置的“上一版（更早）”在 i+1；首版无上一版
        const older = versions[i + 1];
        return <VersionCard key={v.version} v={v} prev={older} />;
      })}
    </div>
  );
}
