/* global fetch, document, window, console, setTimeout, setInterval, clearInterval, URL */
/**
 * EnvManage 环境快速切换面板
 *
 * 通过 HTML 注入机制加载到被代理页面中，在右下角显示悬浮球，
 * 点击可展开环境列表，支持一键切换环境。
 *
 * 特性：
 * - Shadow DOM 样式隔离，不干扰宿主页面
 * - 纯原生 JS ESM，无框架依赖
 * - 自动检测当前环境并高亮显示
 * - 支持切换/启动/停止操作
 * - 切换后自动重定向到新环境
 */

const API_PREFIX = "/dev-manage-api";

// ==================== 悬浮球拖拽 / 贴边收起常量 ====================
const BALL_SIZE = 48; // 悬浮球尺寸（与 CSS 保持一致）
const EDGE_MARGIN = 24; // 默认距窗口边缘距离
const DOCK_THRESHOLD = 40; // 距边缘小于该值（px）时吸附到边缘
const HOVER_THRESHOLD = 48; // 收起后鼠标靠近提示线多少像素内触发展开
const HOVER_PADDING = 12; // 判断鼠标是否已离开悬浮球的余量
const POSITION_KEY = "envm-switcher-position"; // localStorage 存储键

// ==================== 工具函数 ====================

/**
 * 通用 fetch 封装，处理两种响应格式：
 * 1. 标准包裹格式 { code, message, data, timestamp }
 * 2. 原始格式（如 inject/getcurrentenv 返回的 { envId }）
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();

  // 如果响应有 code 字段，解包 data
  if (json && typeof json.code === "number") {
    if (json.code !== 200) {
      throw new Error(json.message || "请求失败");
    }
    return json.data;
  }
  // 否则直接返回原始 json
  return json;
}

// ==================== 主类 ====================

class EnvmSwitcher {
  constructor() {
    this.envList = [];
    this.devServerList = [];
    this.currentEnvId = null;
    this.isPanelOpen = false;
    this.isSwitching = false;
    this.pollTimer = null;

    // 悬浮球位置与收起状态
    this.pos = { left: 0, top: 0 };
    this.dockedEdge = null; // null | 'left' | 'right' | 'top' | 'bottom'
    this.isCollapsed = false;
    this.dragState = null;
    this.dragMoved = false;

    // 创建 Shadow DOM 容器
    this.host = document.createElement("div");
    this.host.id = "__envm_switcher_host";
    this.shadow = this.host.attachShadow({ mode: "open" });

    // 注入样式
    const style = document.createElement("style");
    style.textContent = this._getStyles();
    this.shadow.appendChild(style);

    // 创建 UI 结构
    this._render();

    // 恢复并应用悬浮球位置（在挂载前设置，避免闪烁）
    this._restorePosition();

    document.body.appendChild(this.host);

    // 初始化
    this._init();
  }

  // ==================== CSS 样式 ====================

  _getStyles() {
    return /* css */ `
      :host {
        --envm-bg: #ffffff;
        --envm-text: #333333;
        --envm-text-secondary: #666666;
        --envm-border: #e4e7ed;
        --envm-accent: #409eff;
        --envm-accent-light: #ecf5ff;
        --envm-running: #67c23a;
        --envm-running-bg: #f0f9eb;
        --envm-stopped: #f56c6c;
        --envm-stopped-bg: #fef0f0;
        --envm-warning: #e6a23c;
        --envm-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        --envm-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
        --envm-radius: 12px;
        --envm-radius-sm: 8px;
        --envm-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        --envm-font-size: 13px;
        --envm-font-size-sm: 12px;
        --envm-transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);

        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 99999;
        font-family: var(--envm-font);
        font-size: var(--envm-font-size);
        color: var(--envm-text);
        line-height: 1.5;
        box-sizing: border-box;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --envm-bg: #1e1e1e;
          --envm-text: #e0e0e0;
          --envm-text-secondary: #a0a0a0;
          --envm-border: #404040;
          --envm-accent-light: #1a3a5c;
          --envm-running-bg: #1a3a1a;
          --envm-stopped-bg: #3a1a1a;
          --envm-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          --envm-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
      }

      /* ========== 悬浮球 ========== */
      .ball {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.35);
        cursor: grab;
        touch-action: none;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        transition: transform var(--envm-transition), box-shadow var(--envm-transition), opacity var(--envm-transition);
        user-select: none;
        position: relative;
        overflow: visible;
      }

      .ball::after {
        content: "";
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 3px solid transparent;
        transition: border-color var(--envm-transition);
      }

      .ball.running::after {
        border-color: rgba(103, 194, 58, 0.7);
        box-shadow: 0 0 12px rgba(103, 194, 58, 0.4), inset 0 0 12px rgba(103, 194, 58, 0.15);
      }

      .ball.stopped::after {
        border-color: rgba(245, 108, 108, 0.7);
        box-shadow: 0 0 12px rgba(245, 108, 108, 0.4), inset 0 0 12px rgba(245, 108, 108, 0.15);
      }

      .ball.loading::after {
        border-color: rgba(230, 162, 60, 0.7);
        box-shadow: 0 0 12px rgba(230, 162, 60, 0.4), inset 0 0 12px rgba(230, 162, 60, 0.15);
        animation: ringPulse 1.2s ease-in-out infinite;
      }

      .ball:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 28px rgba(102, 126, 234, 0.5);
      }

      .ball:active {
        transform: scale(0.94);
        cursor: grabbing;
      }

      .ball.collapsed {
        transform: scale(0.3);
        opacity: 0;
        pointer-events: none;
      }

      .ball-label {
        font-size: 12px;
        font-weight: 800;
        color: #ffffff;
        line-height: 1;
        letter-spacing: -0.5px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        position: relative;
        z-index: 1;
      }

      .ball-dot {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.9);
        z-index: 2;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }

      .ball-dot.running {
        background: #67c23a;
      }

      .ball-dot.stopped {
        background: #f56c6c;
      }

      .ball-dot.loading {
        background: #e6a23c;
        animation: pulse 1s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.75); }
      }

      @keyframes ringPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.5; }
      }

      /* ========== 边缘收起提示线 ========== */
      .edge-hint {
        position: absolute;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 2px;
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--envm-transition);
        box-shadow: 0 0 10px rgba(102, 126, 234, 0.6);
      }

      .edge-hint.visible {
        opacity: 1;
      }

      /* ========== 面板 ========== */
      .panel {
        position: absolute;
        bottom: 60px;
        right: 0;
        width: 280px;
        max-height: 420px;
        background: var(--envm-bg);
        border-radius: var(--envm-radius);
        box-shadow: var(--envm-shadow);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: opacity var(--envm-transition), transform var(--envm-transition);
        border: 1px solid var(--envm-border);
      }

      /* 面板开口方向：根据悬浮球在视口中的位置动态调整，避免超出视口 */
      :host([data-panel-v="down"]) .panel {
        top: 60px;
        bottom: auto;
      }

      :host([data-panel-v="up"]) .panel {
        bottom: 60px;
        top: auto;
      }

      :host([data-panel-h="left"]) .panel {
        left: 0;
        right: auto;
      }

      :host([data-panel-h="right"]) .panel {
        right: 0;
        left: auto;
      }

      .panel.hidden {
        opacity: 0;
        transform: translateY(8px) scale(0.96);
        pointer-events: none;
      }

      /* ========== 面板头部 ========== */
      .panel-header {
        padding: 14px 16px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--envm-border);
        flex-shrink: 0;
      }

      .panel-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--envm-text);
      }

      .panel-actions {
        display: flex;
        gap: 4px;
      }

      .icon-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: var(--envm-text-secondary);
        cursor: pointer;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: background 0.15s, color 0.15s;
        padding: 0;
      }

      .icon-btn:hover {
        background: var(--envm-border);
        color: var(--envm-text);
      }

      .icon-btn svg {
        width: 16px;
        height: 16px;
      }

      /* ========== 当前环境信息条 ========== */
      .current-env-bar {
        padding: 10px 16px;
        background: var(--envm-accent-light);
        border-bottom: 1px solid var(--envm-border);
        flex-shrink: 0;
      }

      .current-env-name {
        font-weight: 600;
        color: var(--envm-accent);
        font-size: var(--envm-font-size);
        margin-bottom: 2px;
      }

      .current-env-detail {
        font-size: var(--envm-font-size-sm);
        color: var(--envm-text-secondary);
      }

      /* ========== 环境列表 ========== */
      .panel-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px 0;
      }

      .panel-list::-webkit-scrollbar {
        width: 4px;
      }

      .panel-list::-webkit-scrollbar-thumb {
        background: var(--envm-border);
        border-radius: 2px;
      }

      .env-item {
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: background 0.15s;
        border-left: 3px solid transparent;
      }

      .env-item:hover {
        background: var(--envm-accent-light);
      }

      .env-item.current {
        border-left-color: var(--envm-accent);
        background: var(--envm-accent-light);
      }

      .env-item.switching {
        pointer-events: none;
        opacity: 0.6;
      }

      .item-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .item-status-dot.running {
        background: var(--envm-running);
        box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
      }

      .item-status-dot.stopped {
        background: var(--envm-stopped);
      }

      .item-info {
        flex: 1;
        min-width: 0;
      }

      .item-name {
        font-weight: 500;
        font-size: var(--envm-font-size);
        color: var(--envm-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-url {
        font-size: var(--envm-font-size-sm);
        color: var(--envm-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-port {
        font-size: var(--envm-font-size-sm);
        color: var(--envm-text-secondary);
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }

      .item-action {
        flex-shrink: 0;
        font-size: var(--envm-font-size-sm);
        padding: 3px 10px;
        border-radius: 4px;
        border: 1px solid var(--envm-accent);
        background: transparent;
        color: var(--envm-accent);
        cursor: pointer;
        font-family: var(--envm-font);
        transition: all 0.15s;
        white-space: nowrap;
      }

      .item-action:hover {
        background: var(--envm-accent);
        color: #fff;
      }

      .item-action.stop {
        border-color: var(--envm-stopped);
        color: var(--envm-stopped);
      }

      .item-action.stop:hover {
        background: var(--envm-stopped);
        color: #fff;
      }

      /* ========== 代理目标子项（DevServer 切换） ========== */
      .proxy-target-item {
        padding: 7px 16px 7px 36px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: default;
        transition: background 0.15s;
        border-left: 3px solid transparent;
        font-size: var(--envm-font-size-sm);
        background: var(--envm-bg);
      }

      .proxy-target-item:hover {
        background: var(--envm-accent-light);
      }

      .proxy-target-item.current {
        border-left-color: var(--envm-accent);
        background: var(--envm-accent-light);
      }

      .proxy-target-item.switching {
        pointer-events: none;
        opacity: 0.6;
      }

      .proxy-target-indent {
        width: 0;
        flex-shrink: 0;
      }

      .proxy-target-active {
        flex-shrink: 0;
        color: var(--envm-accent);
        font-size: 10px;
        font-weight: 700;
      }

      .proxy-target-btn {
        flex-shrink: 0;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid var(--envm-accent);
        background: transparent;
        color: var(--envm-accent);
        cursor: pointer;
        font-family: var(--envm-font);
        transition: all 0.15s;
        white-space: nowrap;
      }

      .proxy-target-btn:hover {
        background: var(--envm-accent);
        color: #fff;
      }

      /* ========== 空状态 ========== */
      .panel-empty {
        padding: 32px 16px;
        text-align: center;
        color: var(--envm-text-secondary);
        font-size: var(--envm-font-size);
      }

      /* ========== 错误提示 ========== */
      .toast {
        position: absolute;
        bottom: 64px;
        right: 0;
        background: var(--envm-stopped);
        color: #fff;
        padding: 8px 14px;
        border-radius: var(--envm-radius-sm);
        font-size: var(--envm-font-size-sm);
        box-shadow: var(--envm-shadow-sm);
        animation: slideIn 0.3s ease-out;
        max-width: 280px;
      }

      /* 提示条跟随悬浮球方向对齐，避免贴顶 / 贴左时超出视口 */
      :host([data-panel-v="down"]) .toast {
        top: 64px;
        bottom: auto;
      }

      :host([data-panel-v="up"]) .toast {
        bottom: 64px;
        top: auto;
      }

      :host([data-panel-h="left"]) .toast {
        left: 0;
        right: auto;
      }

      :host([data-panel-h="right"]) .toast {
        right: 0;
        left: auto;
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
  }

  // ==================== 渲染 DOM ====================

  _render() {
    this.shadow.innerHTML += /* html */ `
      <div id="ball" class="ball stopped" title="环境切换">
        <span id="ballLabel" class="ball-label">...</span>
        <span id="ballDot" class="ball-dot stopped"></span>
      </div>
      <div id="edgeHint" class="edge-hint"></div>
      <div id="panel" class="panel hidden">
        <div class="panel-header">
          <span class="panel-title">环境切换</span>
          <div class="panel-actions">
            <button id="refreshBtn" class="icon-btn" title="刷新列表">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <button id="dashboardBtn" class="icon-btn" title="打开管理页面">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button id="closeBtn" class="icon-btn" title="关闭">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div id="currentEnvBar" class="current-env-bar" style="display:none;">
          <div id="currentEnvName" class="current-env-name"></div>
          <div id="currentEnvDetail" class="current-env-detail"></div>
        </div>
        <div id="envList" class="panel-list"></div>
        <div id="emptyState" class="panel-empty" style="display:none;">暂无可用环境</div>
      </div>
    `;
  }

  // ==================== DOM 引用缓存 ====================

  _$(id) {
    return this.shadow.getElementById(id);
  }

  // ==================== 初始化 ====================

  async _init() {
    // 绑定事件
    this._$("ball").addEventListener("click", () => {
      // 拖拽移动后不触发点击展开面板
      if (this.dragMoved) return;
      this._togglePanel();
    });
    this._$("closeBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      this._closePanel();
    });
    this._$("refreshBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      this._refresh();
    });
    this._$("dashboardBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      this._openDashboard();
    });

    // 点击面板外部关闭
    document.addEventListener("click", (e) => {
      if (this.isPanelOpen && !this.host.contains(e.target)) {
        this._closePanel();
      }
    });

    // ESC 关闭面板
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isPanelOpen) {
        this._closePanel();
      }
    });

    // 悬浮球拖拽
    this._initDrag();

    // 窗口尺寸变化时重新校正位置
    window.addEventListener("resize", () => this._onResize());

    // 全局鼠标移动：驱动边缘收起 / 展开
    document.addEventListener("mousemove", (e) => this._onGlobalMouseMove(e));

    // 初始化面板开口方向
    this._updatePanelOrientation();

    // 初始加载时若悬浮球贴边，默认收起（否则需等首次 mousemove 才收起）
    this._collapse();

    // 加载数据
    await Promise.all([this._fetchCurrentEnv(), this._fetchEnvList()]);
    this._updateUI();

    // 开始定时轮询（每 5 秒刷新环境列表）
    this._startPolling();
  }

  // ==================== 悬浮球拖拽与边缘收起 ====================

  /**
   * 视口内容区宽度（不含滚动条，避免贴边元素遮罩滚动条）
   */
  _viewportWidth() {
    return document.documentElement.clientWidth || window.innerWidth;
  }

  /**
   * 视口内容区高度（不含滚动条）
   */
  _viewportHeight() {
    return document.documentElement.clientHeight || window.innerHeight;
  }

  /**
   * 恢复上次保存的悬浮球位置（localStorage），并检测是否贴边
   */
  _restorePosition() {
    const w = this._viewportWidth();
    const h = this._viewportHeight();

    // 默认：右下角
    this.pos.left = w - BALL_SIZE - EDGE_MARGIN;
    this.pos.top = h - BALL_SIZE - EDGE_MARGIN;

    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved &&
          typeof saved.left === "number" &&
          typeof saved.top === "number"
        ) {
          this.pos.left = saved.left;
          this.pos.top = saved.top;
        }
      }
    } catch {
      // localStorage 不可用或数据损坏时使用默认位置
    }

    this._clampPosition();
    this.dockedEdge = this._detectEdge();
    if (this.dockedEdge) {
      this._snapToEdge(this.dockedEdge);
    }
    this._applyPosition();
  }

  /**
   * 将位置限制在视口内
   */
  _clampPosition() {
    const w = this._viewportWidth();
    const h = this._viewportHeight();
    this.pos.left = Math.min(Math.max(0, this.pos.left), w - BALL_SIZE);
    this.pos.top = Math.min(Math.max(0, this.pos.top), h - BALL_SIZE);
  }

  /**
   * 应用位置到宿主元素
   */
  _applyPosition() {
    this.host.style.left = `${this.pos.left}px`;
    this.host.style.top = `${this.pos.top}px`;
  }

  /**
   * 保存位置到 localStorage
   */
  _savePosition() {
    try {
      window.localStorage.setItem(
        POSITION_KEY,
        JSON.stringify({ left: this.pos.left, top: this.pos.top })
      );
    } catch {
      // 忽略存储失败
    }
  }

  /**
   * 检测悬浮球是否贴边，返回最近的边缘，否则返回 null
   */
  _detectEdge() {
    const w = this._viewportWidth();
    const h = this._viewportHeight();
    const distLeft = this.pos.left;
    const distRight = w - (this.pos.left + BALL_SIZE);
    const distTop = this.pos.top;
    const distBottom = h - (this.pos.top + BALL_SIZE);
    const min = Math.min(distLeft, distRight, distTop, distBottom);

    if (min > DOCK_THRESHOLD) return null;
    if (min === distLeft) return "left";
    if (min === distRight) return "right";
    if (min === distTop) return "top";
    return "bottom";
  }

  /**
   * 将悬浮球吸附到指定边缘（与边缘齐平）
   */
  _snapToEdge(edge) {
    const w = this._viewportWidth();
    const h = this._viewportHeight();
    if (edge === "left") this.pos.left = 0;
    else if (edge === "right") this.pos.left = w - BALL_SIZE;
    else if (edge === "top") this.pos.top = 0;
    else if (edge === "bottom") this.pos.top = h - BALL_SIZE;
    this._applyPosition();
  }

  /**
   * 更新面板开口方向（上/下、左/右），保证面板不超出视口
   */
  _updatePanelOrientation() {
    const cx = this.pos.left + BALL_SIZE / 2;
    const cy = this.pos.top + BALL_SIZE / 2;
    this.host.dataset.panelV = cy > this._viewportHeight() / 2 ? "up" : "down";
    this.host.dataset.panelH = cx > this._viewportWidth() / 2 ? "right" : "left";
  }

  // ==================== 拖拽 ====================

  _initDrag() {
    const ball = this._$("ball");
    ball.addEventListener("pointerdown", (e) => this._onDragStart(e));
    ball.addEventListener("pointermove", (e) => this._onDragMove(e));
    ball.addEventListener("pointerup", (e) => this._onDragEnd(e));
    ball.addEventListener("pointercancel", (e) => this._onDragEnd(e));
  }

  _onDragStart(e) {
    // 仅响应主键（鼠标左键 / 触摸）
    if (e.button !== undefined && e.button !== 0) return;

    // 收起状态下被拖拽，先展开
    if (this.isCollapsed) this._expand();

    this.dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: this.pos.left,
      origTop: this.pos.top,
      moved: false,
    };
    this.dragMoved = false;

    try {
      this._$("ball").setPointerCapture(e.pointerId);
    } catch {
      // 某些环境下 setPointerCapture 可能不可用
    }
  }

  _onDragMove(e) {
    if (!this.dragState) return;

    const dx = e.clientX - this.dragState.startX;
    const dy = e.clientY - this.dragState.startY;

    // 小于阈值视为点击，不触发拖拽
    if (!this.dragState.moved && Math.hypot(dx, dy) < 4) return;

    this.dragState.moved = true;
    this.dragMoved = true;

    this.pos.left = this.dragState.origLeft + dx;
    this.pos.top = this.dragState.origTop + dy;
    this._applyPosition();
  }

  _onDragEnd() {
    if (!this.dragState) return;
    const wasMoved = this.dragState.moved;
    this.dragState = null;

    if (wasMoved) {
      this._clampPosition();
      this.dockedEdge = this._detectEdge();
      if (this.dockedEdge) {
        this._snapToEdge(this.dockedEdge);
      }
      this._applyPosition();
      this._savePosition();
      this._updatePanelOrientation();
    }

    // 延迟清除拖拽标记，确保随后的 click 事件能读取到
    setTimeout(() => {
      this.dragMoved = false;
    }, 0);
  }

  // ==================== 边缘收起 / 展开 ====================

  _collapse() {
    if (this.isCollapsed || !this.dockedEdge) return;
    if (this.isPanelOpen) this._closePanel();
    this.isCollapsed = true;
    this._$("ball").classList.add("collapsed");
    this._updateEdgeHint();
    this._$("edgeHint").classList.add("visible");
    // 收起后释放宿主指针事件，避免遮挡页面内容
    this.host.style.pointerEvents = "none";
  }

  _expand() {
    if (!this.isCollapsed) return;
    this.isCollapsed = false;
    this._$("ball").classList.remove("collapsed");
    this._$("edgeHint").classList.remove("visible");
    this.host.style.pointerEvents = "";
  }

  /**
   * 更新边缘提示线的位置与朝向
   */
  _updateEdgeHint() {
    if (!this.dockedEdge) return;
    const hint = this._$("edgeHint");
    if (!hint) return;

    const THICK = 4; // 提示线粗细
    const LEN = 40; // 提示线长度
    const cx = BALL_SIZE / 2; // 悬浮球中心（相对宿主）
    const cy = BALL_SIZE / 2;

    hint.style.top = "";
    hint.style.right = "";
    hint.style.bottom = "";
    hint.style.left = "";

    if (this.dockedEdge === "left" || this.dockedEdge === "right") {
      hint.style.width = `${THICK}px`;
      hint.style.height = `${LEN}px`;
      hint.style.top = `${cy - LEN / 2}px`;
      if (this.dockedEdge === "left") hint.style.left = "0";
      else hint.style.right = "0";
    } else {
      hint.style.width = `${LEN}px`;
      hint.style.height = `${THICK}px`;
      hint.style.left = `${cx - LEN / 2}px`;
      if (this.dockedEdge === "top") hint.style.top = "0";
      else hint.style.bottom = "0";
    }
  }

  /**
   * 判断坐标是否靠近提示线（用于收起后触发展开）
   */
  _isNearHint(x, y) {
    const cx = this.pos.left + BALL_SIZE / 2;
    const cy = this.pos.top + BALL_SIZE / 2;
    const HALF = 20; // 提示线半长
    const PAD = 16;

    switch (this.dockedEdge) {
      case "left":
        return x < HOVER_THRESHOLD && Math.abs(y - cy) < HALF + PAD;
      case "right":
        return (
          x > this._viewportWidth() - HOVER_THRESHOLD && Math.abs(y - cy) < HALF + PAD
        );
      case "top":
        return y < HOVER_THRESHOLD && Math.abs(x - cx) < HALF + PAD;
      case "bottom":
        return (
          y > this._viewportHeight() - HOVER_THRESHOLD && Math.abs(x - cx) < HALF + PAD
        );
      default:
        return false;
    }
  }

  /**
   * 判断坐标是否仍悬浮在球附近
   */
  _isNearBall(x, y) {
    const cx = this.pos.left + BALL_SIZE / 2;
    const cy = this.pos.top + BALL_SIZE / 2;
    const r = BALL_SIZE / 2 + HOVER_PADDING;
    return Math.hypot(x - cx, y - cy) < r;
  }

  _onGlobalMouseMove(e) {
    if (!this.dockedEdge || this.dragState) return;

    if (this.isCollapsed) {
      if (this._isNearHint(e.clientX, e.clientY)) this._expand();
    } else if (!this.isPanelOpen && !this._isNearBall(e.clientX, e.clientY)) {
      this._collapse();
    }
  }

  _onResize() {
    this._clampPosition();
    this.dockedEdge = this._detectEdge();
    if (this.dockedEdge) {
      this._snapToEdge(this.dockedEdge);
      this._updateEdgeHint();
    } else {
      if (this.isCollapsed) this._expand();
      this._applyPosition();
    }
    this._updatePanelOrientation();
  }

  // ==================== API 调用 ====================

  async _fetchCurrentEnv() {
    try {
      const data = await apiFetch(`${API_PREFIX}/inject/getcurrentenv`);
      this.currentEnvId = (data && data.envId) || null;
    } catch {
      // 获取当前环境失败，保持上一次的值
    }
  }

  async _fetchEnvList() {
    try {
      const data = await apiFetch(`${API_PREFIX}/env/getlist`);
      this.envList = (data && data.list) || [];
    } catch {
      // 保持上一次的列表
    }
  }

  async _fetchDevServerList() {
    try {
      const data = await apiFetch(`${API_PREFIX}/server/list`);
      this.devServerList = (data && data.list) || [];
    } catch {
      // 保持上一次的列表
    }
  }

  async _switchEnv(currentEnvId, targetEnvId) {
    return await apiFetch(`${API_PREFIX}/env/switch`, {
      method: "POST",
      body: JSON.stringify({ currentEnvId, targetEnvId }),
    });
  }

  async _switchProxy(envId, devServerId) {
    return await apiFetch(`${API_PREFIX}/env/proxy/switch`, {
      method: "POST",
      body: JSON.stringify({ envId, devServerId }),
    });
  }

  // ==================== UI 更新 ====================

  _updateUI() {
    this._updateBall();
    this._updatePanel();
  }

  _updateBall() {
    const currentEnv = this.envList.find((e) => e.id === this.currentEnvId);
    const label = this._$("ballLabel");
    const dot = this._$("ballDot");
    const ball = this._$("ball");

    if (currentEnv && currentEnv.port) {
      // 显示端口后两位
      const portStr = String(currentEnv.port);
      label.textContent = portStr.slice(-2);
    } else if (currentEnv && currentEnv.name) {
      label.textContent = currentEnv.name.slice(0, 3).toUpperCase();
    } else {
      label.textContent = "ENV";
    }

    // 重置状态 class
    ball.className = "ball";
    dot.className = "ball-dot";

    let statusClass = "stopped";
    if (this.isSwitching) {
      statusClass = "loading";
    } else if (currentEnv && currentEnv.status === "running") {
      statusClass = "running";
    }

    ball.classList.add(statusClass);
    dot.classList.add(statusClass);

    // className 重置会覆盖 collapsed，若处于收起状态则恢复
    if (this.isCollapsed) ball.classList.add("collapsed");
  }

  _updatePanel() {
    const currentEnv = this.envList.find((e) => e.id === this.currentEnvId);

    // 更新当前环境信息条
    const currentBar = this._$("currentEnvBar");
    if (currentEnv) {
      currentBar.style.display = "block";
      this._$("currentEnvName").textContent =
        currentEnv.name || currentEnv.apiBaseUrl || "当前环境";

      // 查找当前绑定的 DevServer 名称
      const currentDS = this.devServerList.find(
        (ds) => ds.id === currentEnv.devServerId
      );
      const dsLabel = currentDS
        ? currentDS.name || currentDS.devServerUrl || "未知"
        : "未绑定";

      this._$("currentEnvDetail").innerHTML =
        `端口: ${currentEnv.port} | Dev: ${this._escapeHtml(dsLabel)} | 状态: ${currentEnv.status === "running" ? "运行中" : "已停止"}`;
    } else {
      currentBar.style.display = "none";
    }

    // 更新环境列表
    const listEl = this._$("envList");
    const emptyEl = this._$("emptyState");

    if (this.envList.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }

    emptyEl.style.display = "none";
    listEl.innerHTML = this.envList
      .map((env) => this._renderEnvItem(env))
      .join("");

    // 绑定每个环境项的事件
    listEl.querySelectorAll(".env-item").forEach((el) => {
      const envId = el.dataset.envId;
      const env = this.envList.find((e) => e.id === envId);
      if (!env) return;

      el.addEventListener("click", (e) => {
        // 如果点击的是操作按钮，不触发行点击
        if (e.target.classList.contains("item-action")) return;
        this._handleEnvAction(env);
      });
    });

    listEl.querySelectorAll(".item-action").forEach((btn) => {
      const envId = btn.dataset.envId;
      const env = this.envList.find((e) => e.id === envId);
      if (!env) return;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._handleEnvAction(env);
      });
    });

    // 绑定 DevServer 代理目标按钮事件
    listEl.querySelectorAll(".proxy-target-btn").forEach((btn) => {
      const dsId = btn.dataset.dsId;
      const devServer = this.devServerList.find((ds) => ds.id === dsId);
      if (!devServer) return;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentEnv = this.envList.find((e) => e.id === this.currentEnvId);
        if (currentEnv) {
          this._doSwitchProxy(currentEnv, devServer);
        }
      });
    });
  }

  _renderEnvItem(env) {
    const isCurrent = env.id === this.currentEnvId;
    const isRunning = env.status === "running";
    const envName = env.name || env.apiBaseUrl || "未命名环境";
    const isSwitching = this.isSwitching;

    let actionBtn = "";
    // 当前页面正在访问的环境不显示操作按钮，其它环境统一展示「切换」
    if (!isCurrent) {
      actionBtn = `<button class="item-action" data-env-id="${env.id}" ${isSwitching ? "disabled" : ""}>切换</button>`;
    }

    // 当前运行中的环境：渲染 DevServer 代理目标子列表
    let proxyTargetsHtml = "";
    if (isCurrent && isRunning && this.devServerList.length > 0) {
      proxyTargetsHtml = this._renderDevServerTargets(env);
    }

    return /* html */ `
      <div class="env-item ${isCurrent ? "current" : ""} ${isSwitching ? "switching" : ""}"
           data-env-id="${env.id}">
        <span class="item-status-dot ${isRunning ? "running" : "stopped"}"></span>
        <span class="item-info">
          <span class="item-name">${this._escapeHtml(envName)}</span>
          <span class="item-url">${this._escapeHtml(env.apiBaseUrl || "")}</span>
        </span>
        <span class="item-port">:${env.port}</span>
        ${actionBtn}
      </div>
      ${proxyTargetsHtml}
    `;
  }

  /**
   * 渲染当前环境下的 DevServer 代理目标子列表
   * @param {Object} env - 当前环境信息
   * @returns {string} HTML 字符串
   */
  _renderDevServerTargets(env) {
    return this.devServerList
      .map((ds) => {
        const isActive = env.devServerId === ds.id;
        const dsName = ds.name || ds.devServerUrl || "未命名";
        const actionBtn = isActive
          ? '<span class="proxy-target-active">◀</span>'
          : `<button class="proxy-target-btn" data-ds-id="${ds.id}" ${this.isSwitching ? "disabled" : ""}>切换</button>`;

        return /* html */ `
          <div class="proxy-target-item ${isActive ? "current" : ""} ${this.isSwitching ? "switching" : ""}"
               data-ds-id="${ds.id}">
            <span class="proxy-target-indent"></span>
            <span class="item-info">
              <span class="item-name">Dev: ${this._escapeHtml(dsName)}</span>
              <span class="item-url">${this._escapeHtml(ds.devServerUrl || "")}</span>
            </span>
            ${actionBtn}
          </div>
        `;
      })
      .join("");
  }

  // ==================== 事件处理 ====================

  async _togglePanel() {
    if (this.isPanelOpen) {
      this._closePanel();
    } else {
      this._openPanel();
    }
  }

  async _openPanel() {
    this.isPanelOpen = true;
    this._$("panel").classList.remove("hidden");
    // 展开时刷新数据
    await this._refresh();
  }

  _closePanel() {
    this.isPanelOpen = false;
    this._$("panel").classList.add("hidden");
  }

  async _refresh() {
    await Promise.all([
      this._fetchCurrentEnv(),
      this._fetchEnvList(),
      this._fetchDevServerList(),
    ]);
    this._updateUI();
  }

  _openDashboard() {
    // 打开管理页面的新标签页
    // 使用当前页面的同源 URL 拼接 API 前缀，PreProxyServer 会自动代理到 PostProxyServer
    window.open(`${API_PREFIX}`, "_blank");
  }

  async _handleEnvAction(env) {
    if (this.isSwitching) return;

    // 当前页面正在访问的环境不允许操作，忽略点击；其他环境统一走 switch
    if (this.currentEnvId === env.id) return;

    await this._doSwitch(env);
  }

  async _doSwitch(targetEnv) {
    this.isSwitching = true;
    this._updateUI();

    try {
      // 调用 switch 端点：服务端原子操作，启动目标环境（不关闭当前环境）
      const updatedTarget = await this._switchEnv(this.currentEnvId, targetEnv.id);

      // 使用服务端返回的最新环境信息（含端口号）进行重定向
      this._redirectTo(updatedTarget || targetEnv);
    } catch (err) {
      this._showToast(`切换失败: ${err.message}`);
      await this._refresh();
    } finally {
      this.isSwitching = false;
      this._updateUI();
    }
  }

  _redirectTo(env) {
    const currentUrl = new URL(window.location.href);
    const newUrl = `${currentUrl.protocol}//${currentUrl.hostname}:${env.port}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.location.replace(newUrl);
  }

  /**
   * 切换当前环境的 DevServer 绑定
   * 不换端口、不重启代理，仅更新 devServerId
   * @param {Object} env - 当前环境信息
   * @param {Object} devServer - 目标 DevServer 信息
   */
  async _doSwitchProxy(env, devServer) {
    if (this.isSwitching) return;

    this.isSwitching = true;
    this._updateUI();

    try {
      await this._switchProxy(env.id, devServer.id);
      await this._refresh();
      // 代理切换后刷新当前页面，从新 DevServer 加载资源
      window.location.reload();
    } catch (err) {
      this._showToast(`切换代理失败: ${err.message}`);
    } finally {
      this.isSwitching = false;
      this._updateUI();
    }
  }

  // ==================== 辅助方法 ====================

  _showToast(message) {
    // 移除已有的 toast
    const existing = this.shadow.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.shadow.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  _startPolling() {
    this._stopPolling();
    this.pollTimer = setInterval(() => {
      if (!this.isPanelOpen) {
        this._fetchEnvList().then(() => this._updateBall());
      }
    }, 5000);
  }

  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ==================== 销毁 ====================

  destroy() {
    this._stopPolling();
    if (this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
  }
}

// ==================== 启动 ====================

function bootstrap() {
  // 避免重复初始化
  if (window.__envm_switcher) return;

  try {
    window.__envm_switcher = new EnvmSwitcher();
  } catch (err) {
    console.error("[EnvManage] 环境切换面板初始化失败:", err);
  }
}

// 确保 DOM 就绪后初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
