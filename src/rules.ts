import { Customer, EyeParams, FittingVersion, RecordStatus, RULES, Side } from "./types";

export const emptyEye = (): EyeParams => ({
  sphere: null,
  cylinder: null,
  axis: null,
  add: null,
  fittingHeight: null,
});

export const emptyEyes = (): Record<Side, EyeParams> => ({
  OD: emptyEye(),
  OS: emptyEye(),
});

/** 镜架中心高度（从镜架底部起 mm）= 镜架高度 / 2 */
export function frameCenter(frameHeight: number | null): number | null {
  return typeof frameHeight === "number" && frameHeight > 0 ? frameHeight / 2 : null;
}

export const EYE_FIELD_LABEL = {
  sphere: "远用球镜",
  cylinder: "远用柱镜",
  axis: "轴位",
  add: "下加光",
  fittingHeight: "瞳高",
} as const;

function eyeChecks(side: Side, eye: EyeParams, center: number | null): string[] {
  const out: string[] = [];
  const name = side === "OD" ? "右眼" : "左眼";

  if (eye.add !== null && (eye.add < RULES.addMin || eye.add > RULES.addMax)) {
    out.push(
      `${name}下加光 ${fmt(eye.add)}D 越过 ${RULES.addMin.toFixed(2)}–${RULES.addMax.toFixed(2)}D 区间`
    );
  }
  if (
    eye.fittingHeight !== null &&
    center !== null &&
    Math.abs(eye.fittingHeight - center) > RULES.phToleranceMm
  ) {
    out.push(
      `${name}瞳高 ${fmt(eye.fittingHeight)}mm 偏离镜架中心 ${fmt(center)}mm 达 ${fmt(
        Math.abs(eye.fittingHeight - center)
      )}mm（> ${RULES.phToleranceMm}mm）`
    );
  }
  // 柱镜为 0 时轴位无意义，允许填 0；仅在有散光时校验 1–180°
  if (eye.cylinder !== 0 && eye.axis !== null && (eye.axis < RULES.axisMin || eye.axis > RULES.axisMax)) {
    out.push(`${name}轴位 ${eye.axis}° 超出 1–180°`);
  }
  return out;
}

/** 当前试戴数据命中的规则提示 */
export function activeFlags(c: Customer): string[] {
  const center = frameCenter(c.frameHeight);
  return [...eyeChecks("OD", c.eyes.OD, center), ...eyeChecks("OS", c.eyes.OS, center)];
}

/**
 * 状态：
 * - 已确认且未进入改版 → confirmed
 * - 当前不适分 ≥4 → paused（最高优先）
 * - 命中复核规则（含本试戴轮次曾暂停）→ review
 * - 其余 → draft（首配草稿 或 改版进行中）
 */
export function deriveStatus(c: Customer): RecordStatus {
  if (c.versions.length > 0 && !c.adjustMode) return "confirmed";
  if (typeof c.discomfort === "number" && c.discomfort >= RULES.discomfortPause) return "paused";
  if (activeFlags(c).length > 0 || c.pausedOnce) return "review";
  return "draft";
}

export const STATUS_META: Record<RecordStatus, { text: string; cls: string }> = {
  draft: { text: "草稿", cls: "st-draft" },
  review: { text: "待复核", cls: "st-review" },
  paused: { text: "已暂停", cls: "st-paused" },
  confirmed: { text: "已确认", cls: "st-confirmed" },
};

/** 确认/另存前的必填校验 */
export function missingFields(c: Customer): string[] {
  const out: string[] = [];
  if (!c.name.trim()) out.push("顾客姓名");
  if (c.frameHeight === null) out.push("镜架高度");
  (["OD", "OS"] as Side[]).forEach((side) => {
    const eye = c.eyes[side];
    const n = side === "OD" ? "右眼" : "左眼";
    (["sphere", "cylinder", "axis", "add", "fittingHeight"] as const).forEach((k) => {
      if (eye[k] === null) out.push(`${n}${EYE_FIELD_LABEL[k]}`);
    });
  });
  if (c.trialMinutes === null) out.push("试戴时长");
  if (c.discomfort === null) out.push("不适分");
  if (c.adjustMode && !c.adjustReason.trim()) out.push("改版原因");
  return out;
}

export interface ConfirmBlock {
  canConfirm: boolean;
  reasons: string[];
}

/** 确认拦截：缺字段 / 当前不适≥4 必须重新试戴 / 待复核项（含曾暂停）缺医生意见 */
export function confirmBlock(c: Customer): ConfirmBlock {
  const reasons: string[] = [];
  const missing = missingFields(c);
  if (missing.length) reasons.push(`请先补全：${missing.join("、")}`);

  if (c.discomfort !== null && c.discomfort >= RULES.discomfortPause) {
    reasons.push(
      `看远看近切换不适 ${c.discomfort} 分已达暂停线 ${RULES.discomfortPause} 分，请按医生意见调整参数并重新试戴至 ${RULES.discomfortPause} 分以下`
    );
  } else if ((activeFlags(c).length > 0 || c.pausedOnce) && !c.doctorNote.trim()) {
    reasons.push("存在待复核 / 暂停项，须由医生填写调整意见后才能确认");
  }
  return { canConfirm: reasons.length === 0, reasons };
}

export function buildVersion(c: Customer, by: string): FittingVersion {
  const first = c.versions.length === 0;
  return {
    version: c.versions.length + 1,
    confirmedAt: new Date().toISOString(),
    confirmedBy: by.trim() || "门店",
    reason: first ? c.adjustReason.trim() || "首次试戴确认" : c.adjustReason.trim(),
    doctorNote: c.doctorNote.trim(),
    trialMinutes: c.trialMinutes ?? 0,
    discomfort: c.discomfort ?? 0,
    eyes: JSON.parse(JSON.stringify(c.eyes)) as Record<Side, EyeParams>,
    flags: c.pausedOnce
      ? [...activeFlags(c), "试戴中曾因不适≥4分暂停，已按医生意见重新试戴合格"]
      : activeFlags(c),
  };
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function signed(n: number | null): string {
  if (n === null) return "—";
  return (n > 0 ? "+" : "") + fmt(n);
}

export function uid(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clockText(iso: string): string {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}
