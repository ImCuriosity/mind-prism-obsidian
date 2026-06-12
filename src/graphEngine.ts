// ============================================================================
// D3.js Force Simulation 그래프 엔진
// 옵시디언 기본 그래프와 달리 물리 파라미터를 직접 조작할 수 있는
// 독자적 SVG 그래프 뷰어입니다.
//
//  - "amorphous"(무정형) 모드: forceManyBody(반발) + forceCenter(중앙 집중)
//  - "para"(분류) 모드: 4대 카테고리별 가상 중력점(forceX/forceY)으로 군집화
// ============================================================================

import * as d3 from "d3";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  GraphLink,
  GraphNode,
  ParaCategory,
  PARA_CATEGORIES,
  ViewMode,
} from "./types";

/** 노드 클릭 시 호출되는 콜백(예: 해당 노트 열기). */
export type NodeClickHandler = (node: GraphNode) => void;

export class GraphEngine {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private root: d3.Selection<SVGGElement, unknown, null, undefined>;
  private linkLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  private nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  private labelLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gravityLayer: d3.Selection<SVGGElement, unknown, null, undefined>;

  private simulation: d3.Simulation<GraphNode, GraphLink>;
  private nodes: GraphNode[] = [];
  private links: GraphLink[] = [];

  private width = 600;
  private height = 400;
  private mode: ViewMode = "amorphous";
  private onNodeClick?: NodeClickHandler;

  /**
   * @param container SVG를 삽입할 부모 DOM 엘리먼트
   * @param onNodeClick 노드 클릭 콜백(옵션)
   */
  constructor(container: HTMLElement, onNodeClick?: NodeClickHandler) {
    this.onNodeClick = onNodeClick;

    // ---- SVG 캔버스 + 레이어 구성 -------------------------------------------
    this.svg = d3
      .select(container)
      .append("svg")
      .attr("class", "para-graph-svg")
      .attr("width", "100%")
      .attr("height", "100%");

    // zoom/pan을 위한 최상위 그룹
    this.root = this.svg.append("g").attr("class", "para-graph-root");

    // 그리기 순서: 중력점(배경) → 엣지 → 노드 → 라벨
    this.gravityLayer = this.root.append("g").attr("class", "gravity-layer");
    this.linkLayer = this.root.append("g").attr("class", "link-layer");
    this.nodeLayer = this.root.append("g").attr("class", "node-layer");
    this.labelLayer = this.root.append("g").attr("class", "label-layer");

    // 줌/팬 동작 연결
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        this.root.attr("transform", event.transform.toString());
      });
    this.svg.call(zoom);

    // ---- 시뮬레이션 초기화(힘은 setMode/update에서 구성) -------------------
    this.simulation = d3
      .forceSimulation<GraphNode>()
      .on("tick", () => this.onTick());
  }

  /** 외부에서 SVG 크기 변화를 알려주면 중심/중력점을 재계산합니다. */
  resize(width: number, height: number): void {
    this.width = Math.max(width, 50);
    this.height = Math.max(height, 50);
    this.applyForces();
    this.simulation.alpha(0.3).restart();
  }

  /** 새 그래프 데이터를 주입하고 화면을 다시 그립니다. */
  setData(nodes: GraphNode[], links: GraphLink[]): void {
    // d3가 source/target 참조를 변형하므로 방어적으로 복사합니다.
    this.nodes = nodes.map((n) => ({ ...n }));
    this.links = links.map((l) => ({
      source: typeof l.source === "string" ? l.source : l.source.id,
      target: typeof l.target === "string" ? l.target : l.target.id,
    }));

    this.simulation.nodes(this.nodes);
    this.renderElements();
    this.applyForces();
    this.simulation.alpha(1).restart();
  }

  /** 모드 전환: force 파라미터를 동적으로 교체하고 부드럽게 재시뮬레이션합니다. */
  setMode(mode: ViewMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyForces();
    this.renderGravityPoints();
    this.simulation.alpha(0.9).restart();
  }

  getMode(): ViewMode {
    return this.mode;
  }

  /** 시뮬레이션을 정지하고 리소스를 정리합니다. */
  destroy(): void {
    this.simulation.stop();
    this.svg.remove();
  }

  // ==========================================================================
  // 내부 구현
  // ==========================================================================

  /** 노드 반지름(연결 차수에 따라 4~14px). */
  private radius(node: GraphNode): number {
    return 4 + Math.min(node.degree, 20) * 0.5;
  }

  /**
   * 현재 모드에 맞는 force들을 시뮬레이션에 (재)설정합니다.
   * 모드 전환의 핵심 로직입니다.
   */
  private applyForces(): void {
    const sim = this.simulation;

    // 공통: 링크 인력 + 노드 충돌(겹침 방지)
    sim.force(
      "link",
      d3
        .forceLink<GraphNode, GraphLink>(this.links)
        .id((d) => d.id)
        .distance(40)
        .strength(0.4)
    );
    sim.force(
      "collide",
      d3.forceCollide<GraphNode>().radius((d) => this.radius(d) + 3)
    );

    if (this.mode === "amorphous") {
      // 무정형: 강한 반발 + 화면 중앙으로 집중
      sim.force("charge", d3.forceManyBody<GraphNode>().strength(-120));
      sim.force(
        "center",
        d3.forceCenter(this.width / 2, this.height / 2).strength(0.05)
      );
      // 분류용 인력은 제거
      sim.force("x", null);
      sim.force("y", null);
    } else {
      // PARA: 약한 반발 + 카테고리별 중력점으로 forceX/forceY 끌어당김
      sim.force("charge", d3.forceManyBody<GraphNode>().strength(-40));
      sim.force("center", null);

      const points = this.gravityPoints();
      sim.force(
        "x",
        d3
          .forceX<GraphNode>((d) => points[d.category].x)
          .strength(0.12)
      );
      sim.force(
        "y",
        d3
          .forceY<GraphNode>((d) => points[d.category].y)
          .strength(0.12)
      );
    }
  }

  /**
   * 4대 카테고리(+unsorted)의 가상 중력점 좌표를 계산합니다.
   * 화면을 2x2 사분면으로 나눠 배치하고, unsorted는 정중앙에 둡니다.
   */
  private gravityPoints(): Record<ParaCategory, { x: number; y: number }> {
    const w = this.width;
    const h = this.height;
    const padX = w * 0.27;
    const padY = h * 0.27;
    return {
      projects: { x: padX, y: padY }, // 좌상
      areas: { x: w - padX, y: padY }, // 우상
      resources: { x: padX, y: h - padY }, // 좌하
      archives: { x: w - padX, y: h - padY }, // 우하
      unsorted: { x: w / 2, y: h / 2 }, // 중앙
    };
  }

  /** PARA 모드에서 중력점 위치에 카테고리 라벨 배경을 그립니다. */
  private renderGravityPoints(): void {
    const points = this.gravityPoints();
    const data =
      this.mode === "para"
        ? PARA_CATEGORIES.map((cat) => ({ cat, ...points[cat] }))
        : [];

    const labels = this.gravityLayer
      .selectAll<SVGTextElement, { cat: ParaCategory; x: number; y: number }>(
        "text.gravity-label"
      )
      .data(data, (d) => d.cat);

    labels.exit().remove();

    labels
      .enter()
      .append("text")
      .attr("class", "gravity-label")
      .attr("text-anchor", "middle")
      .merge(labels as any)
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("fill", (d) => CATEGORY_COLOR[d.cat])
      .text((d) => CATEGORY_LABEL[d.cat]);
  }

  /** 노드/엣지 SVG 엘리먼트를 데이터 바인딩으로 생성합니다. */
  private renderElements(): void {
    // ---- 엣지(line) --------------------------------------------------------
    const link = this.linkLayer
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(this.links);
    link.exit().remove();
    link
      .enter()
      .append("line")
      .attr("class", "para-graph-link")
      .attr("stroke", "var(--background-modifier-border, #555)")
      .attr("stroke-width", 1);

    // ---- 노드(circle) ------------------------------------------------------
    const node = this.nodeLayer
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(this.nodes, (d) => d.id);
    node.exit().remove();
    const nodeEnter = node
      .enter()
      .append("circle")
      .attr("class", "para-graph-node")
      .attr("r", (d) => this.radius(d))
      .attr("fill", (d) => CATEGORY_COLOR[d.category])
      .attr("stroke", "var(--background-primary, #fff)")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .call(this.dragBehavior());

    nodeEnter.append("title").text((d) => d.name);
    nodeEnter.on("click", (_event, d) => this.onNodeClick?.(d));

    // ---- 라벨(text) --------------------------------------------------------
    const label = this.labelLayer
      .selectAll<SVGTextElement, GraphNode>("text")
      .data(this.nodes, (d) => d.id);
    label.exit().remove();
    label
      .enter()
      .append("text")
      .attr("class", "para-graph-node-label")
      .attr("font-size", 9)
      .attr("dx", 8)
      .attr("dy", 3)
      .attr("fill", "var(--text-muted, #999)")
      .text((d) => d.name);

    this.renderGravityPoints();
  }

  /** 매 tick마다 노드/엣지/라벨 위치를 갱신합니다. */
  private onTick(): void {
    this.linkLayer
      .selectAll<SVGLineElement, GraphLink>("line")
      .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
      .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
      .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
      .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

    this.nodeLayer
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .attr("cx", (d) => d.x ?? 0)
      .attr("cy", (d) => d.y ?? 0);

    this.labelLayer
      .selectAll<SVGTextElement, GraphNode>("text")
      .attr("x", (d) => d.x ?? 0)
      .attr("y", (d) => d.y ?? 0);
  }

  /** 노드 드래그 동작(마우스/터치 모두 지원). */
  private dragBehavior(): d3.DragBehavior<SVGCircleElement, GraphNode, unknown> {
    return d3
      .drag<SVGCircleElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }
}
