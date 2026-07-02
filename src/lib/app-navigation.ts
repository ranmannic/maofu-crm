const NAV_STACK_KEY = "maofu_nav_stack";
const PAGE_STATE_PREFIX = "maofu_page_state:";

function readStack(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(NAV_STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
}

export function getCurrentHref(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

/** 进入子页面前，将当前页压入返回栈 */
export function pushNavStack(fromHref: string) {
  if (!fromHref || typeof window === "undefined") return;
  const stack = readStack();
  if (stack[stack.length - 1] !== fromHref) {
    stack.push(fromHref);
  }
  writeStack(stack);
}

/** 返回上一级：弹出栈顶目标地址 */
export function popNavStack(): string | null {
  const stack = readStack();
  if (stack.length === 0) return null;
  const target = stack.pop()!;
  writeStack(stack);
  return target;
}

export function savePageState<T extends object>(routeKey: string, state: T) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    PAGE_STATE_PREFIX + routeKey,
    JSON.stringify({ ...state, scrollY: window.scrollY })
  );
}

export function peekPageState<T extends object>(routeKey: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PAGE_STATE_PREFIX + routeKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearPageState(routeKey: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PAGE_STATE_PREFIX + routeKey);
}

export function consumePageState<T extends object>(
  routeKey: string
): T | null {
  const state = peekPageState<T>(routeKey);
  if (state) clearPageState(routeKey);
  return state;
}

export function restoreScrollY(scrollY?: number) {
  if (typeof window === "undefined" || scrollY == null) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  });
}
