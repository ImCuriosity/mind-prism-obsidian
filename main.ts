// ============================================================================
// 메인 엔트리
// Plugin + ItemView를 정의하고, 하이브리드 레이아웃(트리 + D3 그래프)과
// 모드 전환(무정형 ↔ PARA 분류)을 와이어링합니다.
// ============================================================================

import {
  ItemView,
  Plugin,
  TFile,
  WorkspaceLeaf,
  debounce,
} from "obsidian";

import { parseVault } from "./src/dataParser";
import { GraphEngine } from "./src/graphEngine";
import { renderTree } from "./src/treeRenderer";
import { VaultGraphData, ViewMode } from "./src/types";

export const VIEW_TYPE_PARA_CLUSTER = "para-cluster-view";

// ----------------------------------------------------------------------------
// 플러그인 클래스
// ----------------------------------------------------------------------------
export default class ParaClusterPlugin extends Plugin {
  async onload(): Promise<void> {
    // 커스텀 ItemView 등록
    this.registerView(
      VIEW_TYPE_PARA_CLUSTER,
      (leaf) => new ParaClusterView(leaf)
    );

    // 리본 아이콘 / 커맨드로 뷰 열기
    this.addRibbonIcon("git-fork", "PARA 군집 뷰어 열기", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-para-cluster-view",
      name: "PARA 군집 뷰어 열기",
      callback: () => void this.activateView(),
    });
  }

  /** 우측 사이드바에 뷰를 활성화(이미 있으면 드러내기). */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_PARA_CLUSTER);

    let leaf: WorkspaceLeaf | null;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({
        type: VIEW_TYPE_PARA_CLUSTER,
        active: true,
      });
    }
    if (leaf) workspace.revealLeaf(leaf);
  }
}

// ----------------------------------------------------------------------------
// 커스텀 뷰 클래스
// ----------------------------------------------------------------------------
class ParaClusterView extends ItemView {
  private mode: ViewMode = "amorphous";
  private graph: GraphEngine | null = null;
  private data: VaultGraphData | null = null;

  private treePane!: HTMLElement;
  private graphPane!: HTMLElement;
  private amorphousBtn!: HTMLButtonElement;
  private paraBtn!: HTMLButtonElement;

  private resizeObserver: ResizeObserver | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PARA_CLUSTER;
  }
  getDisplayText(): string {
    return "PARA 군집 뷰어";
  }
  getIcon(): string {
    return "git-fork";
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("para-cluster-view");

    this.buildToolbar(root);
    this.buildBody(root);

    // 메타데이터 캐시가 준비된 뒤 첫 렌더(워크스페이스 레이아웃 완료 대기)
    this.app.workspace.onLayoutReady(() => this.refresh());

    // 볼트 변경 시 자동 갱신(과도한 재계산 방지를 위해 디바운스)
    const debouncedRefresh = debounce(() => this.refresh(), 800, true);
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => debouncedRefresh())
    );
  }

  async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.graph?.destroy();
    this.graph = null;
    this.contentEl.empty();
  }

  // ==========================================================================
  // UI 구성
  // ==========================================================================

  /** 상단 모드 전환 툴바. */
  private buildToolbar(root: HTMLElement): void {
    const bar = root.createEl("div", { cls: "para-toolbar" });

    this.amorphousBtn = bar.createEl("button", {
      cls: "para-mode-btn is-active",
      text: "무정형 모드",
    });
    this.paraBtn = bar.createEl("button", {
      cls: "para-mode-btn",
      text: "PARA 분류 모드",
    });

    this.amorphousBtn.addEventListener("click", () =>
      this.switchMode("amorphous")
    );
    this.paraBtn.addEventListener("click", () => this.switchMode("para"));

    // 수동 새로고침 버튼
    const refreshBtn = bar.createEl("button", {
      cls: "para-mode-btn para-refresh-btn",
      text: "↻",
      attr: { "aria-label": "새로고침" },
    });
    refreshBtn.addEventListener("click", () => this.refresh());
  }

  /** 좌(트리)/우(그래프) 분할 본문. CSS로 반응형 처리(좁으면 상하 분할). */
  private buildBody(root: HTMLElement): void {
    const body = root.createEl("div", { cls: "para-body" });
    this.treePane = body.createEl("div", { cls: "para-tree-pane" });
    this.graphPane = body.createEl("div", { cls: "para-graph-pane" });

    // 그래프 엔진 초기화(노드 클릭 → 노트 열기)
    this.graph = new GraphEngine(this.graphPane, (node) =>
      this.openNote(node.id)
    );

    // 그래프 패널 크기 변화를 감지해 시뮬레이션 중심/중력점 재계산
    this.resizeObserver = new ResizeObserver(() => {
      const rect = this.graphPane.getBoundingClientRect();
      this.graph?.resize(rect.width, rect.height);
    });
    this.resizeObserver.observe(this.graphPane);
  }

  // ==========================================================================
  // 동작
  // ==========================================================================

  /** 볼트를 다시 파싱하고 트리·그래프를 갱신합니다. */
  private refresh(): void {
    this.data = parseVault(this.app);

    // 트리 렌더링
    renderTree(this.treePane, this.data.tree, (id) => this.openNote(id));

    // 그래프 데이터 주입 + 현재 크기 반영
    this.graph?.setData(this.data.nodes, this.data.links);
    const rect = this.graphPane.getBoundingClientRect();
    this.graph?.resize(rect.width, rect.height);
  }

  /** 모드 전환 + 버튼 활성 상태 동기화. */
  private switchMode(mode: ViewMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.amorphousBtn.toggleClass("is-active", mode === "amorphous");
    this.paraBtn.toggleClass("is-active", mode === "para");
    this.graph?.setMode(mode);
  }

  /** 파일 경로로 노트를 새 탭(또는 기존 탭)에서 엽니다. */
  private async openNote(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }
}
