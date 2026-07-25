"use client";

/** 线条风人物与场景 SVG — 统一 viewBox 400×200，地面 y=178 */

const STROKE = "#2c4e76";
const ACCENT = "#4ea9ff";
const LIGHT = "#94a3b8";
const SW = 1.75;

const GROUND = 178;

function SceneSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
      overflow="hidden"
      aria-hidden
    >
      <defs>
        <clipPath id="wf-scene-clip">
          <rect x={0} y={0} width={400} height={200} />
        </clipPath>
      </defs>
      <g clipPath="url(#wf-scene-clip)">
        <line
          x1={16}
          y1={GROUND}
          x2={384}
          y2={GROUND}
          stroke={LIGHT}
          strokeWidth={1}
          strokeDasharray="5 4"
          opacity={0.45}
        />
        {children}
      </g>
    </svg>
  );
}

type Pose = "stand" | "talk" | "point" | "receive" | "deliver" | "happy";

/** 精致线条人：x 为身体中心，groundY 为脚底 */
function RefinedPerson({
  x,
  groundY = GROUND,
  scale = 1,
  pose = "stand",
  flip = false,
  className,
}: {
  x: number;
  groundY?: number;
  scale?: number;
  pose?: Pose;
  flip?: boolean;
  className?: string;
}) {
  const s = scale;
  const dir = flip ? -1 : 1;

  const footY = groundY;
  const kneeY = footY - 22 * s;
  const hipY = footY - 42 * s;
  const shoulderY = footY - 68 * s;
  const neckY = footY - 78 * s;
  const headCy = footY - 92 * s;
  const headR = 9.5 * s;

  const leftFootX = x - 7 * s * dir;
  const rightFootX = x + 7 * s * dir;
  const hipX = x;
  const shoulderW = 13 * s;

  // 手臂端点按姿态
  let lHand = { x: x - 22 * s * dir, y: shoulderY + 14 * s };
  let rHand = { x: x + 22 * s * dir, y: shoulderY + 14 * s };
  const lElbow = { x: x - 14 * s * dir, y: shoulderY + 8 * s };
  const rElbow = { x: x + 14 * s * dir, y: shoulderY + 8 * s };

  if (pose === "talk") {
    rHand = { x: x + 18 * s * dir, y: shoulderY - 12 * s };
  } else if (pose === "point") {
    rHand = { x: x + 26 * s * dir, y: shoulderY - 4 * s };
  } else if (pose === "receive") {
    lHand = { x: x - 20 * s * dir, y: shoulderY + 2 * s };
    rHand = { x: x + 20 * s * dir, y: shoulderY + 2 * s };
  } else if (pose === "deliver") {
    lHand = { x: x - 24 * s * dir, y: shoulderY + 4 * s };
    rHand = { x: x + 10 * s * dir, y: shoulderY + 6 * s };
  } else if (pose === "happy") {
    rHand = { x: x + 20 * s * dir, y: shoulderY - 18 * s };
    lHand = { x: x - 16 * s * dir, y: shoulderY + 6 * s };
  }

  return (
    <g className={className} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* 头 */}
      <circle cx={x} cy={headCy} r={headR} fill="white" />
      {/* 脸 */}
      <circle cx={x - 3 * s * dir} cy={headCy - 1 * s} r={1.2 * s} fill={STROKE} stroke="none" />
      <circle cx={x + 3 * s * dir} cy={headCy - 1 * s} r={1.2 * s} fill={STROKE} stroke="none" />
      {pose === "happy" && (
        <path d={`M${x - 4 * s} ${headCy + 3 * s} Q${x} ${headCy + 7 * s} ${x + 4 * s} ${headCy + 3 * s}`} />
      )}
      {/* 颈 & 躯干 */}
      <line x1={x} y1={neckY} x2={x} y2={hipY} />
      <line x1={x - shoulderW * dir} y1={shoulderY} x2={x + shoulderW * dir} y2={shoulderY} />
      {/* 左臂 */}
      <line x1={x - shoulderW * dir} y1={shoulderY} x2={lElbow.x} y2={lElbow.y} />
      <line x1={lElbow.x} y1={lElbow.y} x2={lHand.x} y2={lHand.y} />
      {/* 右臂 */}
      <line x1={x + shoulderW * dir} y1={shoulderY} x2={rElbow.x} y2={rElbow.y} />
      <line x1={rElbow.x} y1={rElbow.y} x2={rHand.x} y2={rHand.y} />
      {/* 手 */}
      <circle cx={lHand.x} cy={lHand.y} r={2.2 * s} fill="white" />
      <circle cx={rHand.x} cy={rHand.y} r={2.2 * s} fill="white" />
      {/* 腿 */}
      <line x1={hipX} y1={hipY} x2={x - 5 * s * dir} y2={kneeY} />
      <line x1={x - 5 * s * dir} y1={kneeY} x2={leftFootX} y2={footY} />
      <line x1={hipX} y1={hipY} x2={x + 5 * s * dir} y2={kneeY} />
      <line x1={x + 5 * s * dir} y1={kneeY} x2={rightFootX} y2={footY} />
    </g>
  );
}

function SpeechBubble({
  x,
  y,
  w,
  h,
  text,
  tailX,
  className,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  tailX: number;
  className?: string;
}) {
  return (
    <g className={className}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="white" stroke={ACCENT} strokeWidth={1.4} />
      <path
        d={`M${tailX - 6} ${y + h} L${tailX} ${y + h + 10} L${tailX + 6} ${y + h}`}
        fill="white"
        stroke={ACCENT}
        strokeWidth={1.4}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 4}
        textAnchor="middle"
        fill={STROKE}
        fontSize={12}
        fontFamily="system-ui,sans-serif"
        fontWeight={500}
      >
        {text}
      </text>
    </g>
  );
}

export function SceneTalk() {
  return (
    <SceneSvg>
      <RefinedPerson x={115} pose="talk" className="wf-arm-wave" />
      <RefinedPerson x={285} flip className="wf-person-idle" />
      <SpeechBubble x={58} y={28} w={82} h={32} text="您好！" tailX={95} className="wf-bubble-a" />
      <SpeechBubble x={258} y={32} w={92} h={32} text="想订酒" tailX={305} className="wf-bubble-b" />
      <g className="wf-dots" fill={ACCENT}>
        <circle cx={198} cy={108} r={2.5} />
        <circle cx={208} cy={108} r={2.5} />
        <circle cx={218} cy={108} r={2.5} />
      </g>
    </SceneSvg>
  );
}

export function SceneOrder() {
  return (
    <SceneSvg>
      <RefinedPerson x={200} pose="point" scale={0.95} />
      <rect x={158} y={118} width={84} height={5} rx={2} stroke={STROKE} strokeWidth={1.4} fill="none" />
      <rect x={170} y={96} width={60} height={22} rx={3} fill="white" stroke={STROKE} strokeWidth={1.4} className="wf-screen-glow" />
      <line x1={178} y1={105} x2={222} y2={105} stroke={ACCENT} strokeWidth={1.2} className="wf-line-draw" />
      <line x1={178} y1={111} x2={208} y2={111} stroke={LIGHT} strokeWidth={1.2} className="wf-line-draw-delay" />
      <g className="wf-order-float" stroke={STROKE} strokeWidth={1.4} fill="white">
        <rect x={268} y={44} width={48} height={58} rx={3} />
        <line x1={276} y1={56} x2={308} y2={56} stroke={ACCENT} />
        <line x1={276} y1={66} x2={298} y2={66} stroke={LIGHT} />
        <line x1={276} y1={76} x2={302} y2={76} stroke={LIGHT} />
        <text x={292} y={92} textAnchor="middle" fill={ACCENT} fontSize={10} fontWeight={600} stroke="none">
          订单
        </text>
      </g>
    </SceneSvg>
  );
}

export function ScenePay() {
  return (
    <SceneSvg>
      <RefinedPerson x={128} pose="deliver" className="wf-hand-out" />
      <RefinedPerson x={272} flip pose="receive" className="wf-hand-in" />
      <rect x={172} y={108} width={56} height={36} rx={5} fill="white" stroke={ACCENT} strokeWidth={1.6} className="wf-pay-pulse" />
      <text x={200} y={131} textAnchor="middle" fill={ACCENT} fontSize={18} fontWeight={700} stroke="none">
        ¥
      </text>
      <g className="wf-coin-fly" stroke={ACCENT} strokeWidth={1.4} fill="white">
        <circle cx={200} cy={96} r={9} />
        <text x={200} y={100} textAnchor="middle" fill={ACCENT} fontSize={9} fontWeight={600} stroke="none">
          ¥
        </text>
      </g>
      <path d="M200 148 L200 164 L195 159 M200 164 L205 159" stroke={ACCENT} strokeWidth={1.4} className="wf-check-draw" fill="none" />
    </SceneSvg>
  );
}

export function SceneFactory() {
  return (
    <SceneSvg>
      <g stroke={STROKE} strokeWidth={1.4} fill="white">
        <rect x={148} y={98} width={104} height={62} fill="white" />
        <polygon points="148,98 200,68 252,98" fill="white" />
        <rect x={172} y={118} width={20} height={16} />
        <rect x={208} y={118} width={20} height={16} />
        <line x1={200} y1={68} x2={200} y2={54} />
        <circle cx={200} cy={50} r={5} className="wf-smoke" fill={LIGHT} stroke="none" opacity={0.5} />
      </g>
      <line x1={100} y1={162} x2={300} y2={162} stroke={LIGHT} strokeWidth={1.2} strokeDasharray="6 4" className="wf-belt" />
      <g stroke={STROKE} strokeWidth={1.4} fill="white">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="118,0; 258,0; 118,0"
          keyTimes="0;0.5;1"
          dur="2.2s"
          repeatCount="indefinite"
        />
        <rect x={0} y={144} width={24} height={18} rx={2} />
        <line x1={5} y1={149} x2={19} y2={149} stroke={ACCENT} />
      </g>
      <RefinedPerson x={310} scale={0.88} className="wf-person-idle" />
    </SceneSvg>
  );
}

export function SceneDelivery() {
  return (
    <SceneSvg>
      <path d="M0 178 Q100 158 200 178 T400 178" fill="none" stroke={LIGHT} strokeWidth={1} opacity={0.3} />
      <g stroke={STROKE} strokeWidth={1.4} fill="white">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="120,0; 220,0; 120,0"
          keyTimes="0;0.5;1"
          dur="2.4s"
          repeatCount="indefinite"
        />
        <rect x={0} y={142} width={68} height={28} rx={3} />
        <rect x={68} y={134} width={32} height={36} rx={3} />
        <rect x={72} y={138} width={20} height={14} rx={2} fill="#eef4fb" stroke={ACCENT} strokeWidth={1} />
        <rect x={10} y={146} width={18} height={14} rx={2} fill="white" stroke={ACCENT} strokeWidth={1} />
        <circle cx={20} cy={172} r={9} fill="white" />
        <circle cx={20} cy={172} r={3.5} fill={STROKE} stroke="none" />
        <circle cx={82} cy={172} r={9} fill="white" />
        <circle cx={82} cy={172} r={3.5} fill={STROKE} stroke="none" />
      </g>
      <g className="wf-speed-lines" stroke={ACCENT} strokeWidth={1.2} strokeLinecap="round" opacity={0.55}>
        <line x1={318} y1={148} x2={342} y2={148} />
        <line x1={322} y1={158} x2={350} y2={158} />
        <line x1={320} y1={168} x2={344} y2={168} />
      </g>
    </SceneSvg>
  );
}

export function SceneReceive() {
  return (
    <SceneSvg>
      <rect x={258} y={92} width={56} height={86} rx={2} fill="white" stroke={STROKE} strokeWidth={1.4} />
      <circle cx={302} cy={135} r={2.5} fill={ACCENT} stroke="none" />
      <RefinedPerson x={282} pose="receive" scale={0.92} />
      <RefinedPerson x={138} pose="deliver" scale={0.9} />
      <g stroke={STROKE} strokeWidth={1.4} fill="white">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="192,0; 228,0; 192,0"
          keyTimes="0;0.5;1"
          dur="1.8s"
          repeatCount="indefinite"
        />
        <rect x={0} y={118} width={32} height={24} rx={2} />
        <line x1={5} y1={125} x2={27} y2={125} stroke={ACCENT} />
        <line x1={5} y1={132} x2={19} y2={132} stroke={LIGHT} />
      </g>
    </SceneSvg>
  );
}

export function SceneLike() {
  return (
    <SceneSvg>
      <RefinedPerson x={200} pose="happy" scale={1} />
      <g className="wf-thumb" stroke={ACCENT} strokeWidth={1.4} fill="white" strokeLinecap="round">
        <path d="M224 96 L224 112 L232 112 L232 102 Q232 96 228 96 Z" />
        <line x1={219} y1={112} x2={219} y2={120} />
      </g>
      <g className="wf-star-a" fill={ACCENT} stroke="none">
        <polygon points="200,24 202,30 208,30 203,34 205,40 200,36 195,40 197,34 192,30 198,30" />
      </g>
      <g className="wf-star-b" fill={ACCENT} stroke="none" opacity={0.75}>
        <polygon points="248,38 249,42 253,42 250,44 251,48 248,46 245,48 246,44 243,42 247,42" />
      </g>
      <g className="wf-star-c" fill={ACCENT} stroke="none" opacity={0.75}>
        <polygon points="152,40 153,44 157,44 154,46 155,50 152,48 149,50 150,46 147,44 151,44" />
      </g>
    </SceneSvg>
  );
}

export function SceneQuote() {
  return (
    <SceneSvg>
      <RefinedPerson x={118} scale={0.9} className="wf-person-idle" />
      <RefinedPerson x={282} pose="talk" scale={0.9} className="wf-arm-wave" />
      <g className="wf-quote-pop">
        <rect x={88} y={32} width={224} height={48} rx={10} fill="white" stroke={ACCENT} strokeWidth={1.6} />
        <path d="M200 80 L192 90 L208 90 Z" fill="white" stroke={ACCENT} strokeWidth={1.6} />
        <text x={200} y={52} textAnchor="middle" fill={STROKE} fontSize={13} fontWeight={600} stroke="none">
          有 YesCRM 帮忙
        </text>
        <text x={200} y={68} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight={500} stroke="none">
          一切都变简单了 ✦
        </text>
      </g>
    </SceneSvg>
  );
}

export const WORKFLOW_SCENES = [
  SceneTalk,
  SceneOrder,
  ScenePay,
  SceneFactory,
  SceneDelivery,
  SceneReceive,
  SceneLike,
] as const;

export const WORKFLOW_LABELS = [
  "销售谈客户",
  "下单",
  "收款",
  "工厂发货",
  "快递送货",
  "客户收货",
  "点赞好评",
] as const;

export const WORKFLOW_CAPTIONS = [
  "跟进记录、客户画像，沟通有据可依",
  "一键录单，规格价格清晰明了",
  "账期账龄自动跟踪，回款不遗漏",
  "库存联动扣减，发货准确高效",
  "物流在途可查，客户安心等待",
  "签收确认回写，闭环完整可追溯",
  "服务满意，复购与口碑自然增长",
] as const;
