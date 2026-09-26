export type Side = "OD" | "OS";

/** 单眼：远用度数 + 下加光 + 镜架瞳高 */
export interface EyeParams {
  sphere: number | null; // 远用球镜 DS
  cylinder: number | null; // 远用柱镜 DC
  axis: number | null; // 轴位 °
  add: number | null; // 下加光 ADD
  fittingHeight: number | null; // 瞳高 PH，从镜架底部起 mm
}

/** 确认后冻结的版本快照（旧记录可查） */
export interface FittingVersion {
  version: number;
  confirmedAt: string; // ISO 时间
  confirmedBy: string;
  reason: string; // 本版调整原因（首版可为“首次试戴确认”）
  doctorNote: string; // 本版医生调整意见
  trialMinutes: number;
  discomfort: number; // 看远看近切换不适分 0–5
  eyes: Record<Side, EyeParams>;
  flags: string[]; // 本版参数仍存在的提示（确认时已由医生处理）
}

export type RecordStatus = "draft" | "review" | "paused" | "confirmed";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  frameHeight: number | null; // 镜架高度 mm，用于计算镜架中心
  createdAt: string;
  updatedAt: string;
  /** 当前试戴工作数据（未确认 / 复核中 / 待调整） */
  eyes: Record<Side, EyeParams>;
  trialMinutes: number | null; // 试戴时长（分钟）
  discomfort: number | null; // 看远/看近切换不适分 0–5
  doctorNote: string; // 医生调整意见
  pausedOnce: boolean; // 本试戴轮次是否曾出现不适 ≥4（粘性，医生意见放行前不可确认）
  adjustMode: boolean; // 已确认后是否正在改参数另存新版本
  adjustReason: string; // 改版原因（另存新版本时必填）
  versions: FittingVersion[]; // 已确认的历史版本
}

export interface AppState {
  customers: Customer[];
}

/** 规则常量 */
export const RULES = {
  addMin: 0.75,
  addMax: 3.0,
  phToleranceMm: 4,
  discomfortPause: 4,
  discomfortMax: 5,
  axisMin: 1,
  axisMax: 180,
};

export const SIDE_META: { key: Side; label: string; short: string }[] = [
  { key: "OD", label: "右眼 (OD)", short: "右" },
  { key: "OS", label: "左眼 (OS)", short: "左" },
];
