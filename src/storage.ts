import { AppState, Customer } from "./types";
import { emptyEyes, uid } from "./rules";

const STORAGE_KEY = "hxwl-11.progressive-fitting.v1";

export function newCustomer(partial?: Partial<Customer>): Customer {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: "",
    phone: "",
    frameHeight: null,
    createdAt: now,
    updatedAt: now,
    eyes: emptyEyes(),
    trialMinutes: null,
    discomfort: null,
    doctorNote: "",
    pausedOnce: false,
    adjustMode: false,
    adjustReason: "",
    versions: [],
    ...partial,
  };
}

function seed(): AppState {
  const now = new Date().toISOString();
  // 已确认一例：含 v1 历史版本，用于演示“旧记录可查 / 改版另存”
  const confirmed = newCustomer({
    name: "周慧兰",
    phone: "138****2046",
    frameHeight: 32,
    eyes: {
      OD: { sphere: -1.0, cylinder: -0.5, axis: 80, add: 1.5, fittingHeight: 16 },
      OS: { sphere: -0.75, cylinder: -0.5, axis: 95, add: 1.5, fittingHeight: 16 },
    },
    trialMinutes: 30,
    discomfort: 1,
    doctorNote: "下加光从 1.25D 上调至 1.50D，近用阅读区清晰，可确认。",
    versions: [
      {
        version: 1,
        confirmedAt: now,
        confirmedBy: "陈医生",
        reason: "首次试戴确认",
        doctorNote: "初配渐进，下加光按近用阅读距离调整。",
        trialMinutes: 20,
        discomfort: 3,
        eyes: {
          OD: { sphere: -1.0, cylinder: -0.5, axis: 80, add: 1.25, fittingHeight: 16 },
          OS: { sphere: -0.75, cylinder: -0.5, axis: 95, add: 1.25, fittingHeight: 16 },
        },
        flags: [],
      },
    ],
  });

  // 待复核一例：瞳高偏离中心 6mm
  const review = newCustomer({
    name: "李建国",
    phone: "139****7710",
    frameHeight: 34,
    eyes: {
      OD: { sphere: 0.25, cylinder: 0, axis: 0, add: 1.75, fittingHeight: 11 },
      OS: { sphere: 0.25, cylinder: 0, axis: 0, add: 1.75, fittingHeight: 11 },
    },
    trialMinutes: 15,
    discomfort: 2,
  });

  // 已暂停一例：不适 4 分
  const paused = newCustomer({
    name: "王秀琴",
    phone: "137****3382",
    frameHeight: 30,
    eyes: {
      OD: { sphere: -0.5, cylinder: -0.75, axis: 170, add: 2.0, fittingHeight: 15 },
      OS: { sphere: -0.5, cylinder: -0.5, axis: 10, add: 2.0, fittingHeight: 15 },
    },
    trialMinutes: 10,
    discomfort: 4,
    doctorNote: "",
    pausedOnce: true,
  });

  return { customers: [paused, review, confirmed] };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.customers)) throw new Error("bad state");
    // 兼容旧版本数据：补齐新增字段
    parsed.customers = parsed.customers.map((c) => ({
      ...newCustomer(),
      ...c,
      eyes: c.eyes ?? emptyEyes(),
      versions: Array.isArray(c.versions) ? c.versions : [],
      pausedOnce:
        c.pausedOnce ??
        (typeof c.discomfort === "number" && c.discomfort >= 4),
    }));
    return parsed;
  } catch {
    return seed();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级（刷新后回到种子数据）
  }
}
