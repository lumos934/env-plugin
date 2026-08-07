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
    this.currentEnvId = null;
    this.isPanelOpen = false;
    this.isSwitching = false;
    this.pollTimer = null;

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
        bottom: 24px;
        right: 24px;
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
        background: var(--envm-bg);
        border: 2px solid var(--envm-border);
        box-shadow: var(--envm-shadow);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        transition: transform var(--envm-transition), box-shadow var(--envm-transition);
        user-select: none;
        position: relative;
        overflow: hidden;
      }

      .ball:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
      }

      .ball:active {
        transform: scale(0.96);
      }

      .ball-label {
        font-size: 11px;
        font-weight: 700;
        color: var(--envm-text);
        line-height: 1;
        letter-spacing: -0.5px;
      }

      .ball-dot {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        border: 1.5px solid var(--envm-bg);
      }

      .ball-dot.running {
        background: var(--envm-running);
      }

      .ball-dot.stopped {
        background: var(--envm-stopped);
      }

      .ball-dot.loading {
        background: var(--envm-warning);
        animation: pulse 1s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
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

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
  }

  // ==================== 渲染 DOM ====================

  _render() {
    this.shadow.innerHTML += /* html */ `
      <div id="ball" class="ball" title="环境切换">
        <span id="ballLabel" class="ball-label">...</span>
        <span id="ballDot" class="ball-dot stopped"></span>
      </div>
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
    this._$("ball").addEventListener("click", () => this._togglePanel());
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

    // 加载数据
    await Promise.all([this._fetchCurrentEnv(), this._fetchEnvList()]);
    this._updateUI();

    // 开始定时轮询（每 5 秒刷新环境列表）
    this._startPolling();
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

  async _startEnv(id) {
    await apiFetch(`${API_PREFIX}/env/start`, {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  }

  async _stopEnv(id) {
    await apiFetch(`${API_PREFIX}/env/stop`, {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  }

  async _switchEnv(currentEnvId, targetEnvId) {
    await apiFetch(`${API_PREFIX}/env/switch`, {
      method: "POST",
      body: JSON.stringify({ currentEnvId, targetEnvId }),
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

    if (currentEnv && currentEnv.port) {
      // 显示端口后两位
      const portStr = String(currentEnv.port);
      label.textContent = portStr.slice(-2);
    } else if (currentEnv && currentEnv.name) {
      label.textContent = currentEnv.name.slice(0, 3).toUpperCase();
    } else {
      label.textContent = "ENV";
    }

    dot.className = "ball-dot";
    if (this.isSwitching) {
      dot.classList.add("loading");
    } else if (currentEnv && currentEnv.status === "running") {
      dot.classList.add("running");
    } else {
      dot.classList.add("stopped");
    }
  }

  _updatePanel() {
    const currentEnv = this.envList.find((e) => e.id === this.currentEnvId);

    // 更新当前环境信息条
    const currentBar = this._$("currentEnvBar");
    if (currentEnv) {
      currentBar.style.display = "block";
      this._$("currentEnvName").textContent =
        currentEnv.name || currentEnv.apiBaseUrl || "当前环境";
      this._$(
        "currentEnvDetail"
      ).textContent = `端口: ${currentEnv.port} | 状态: ${currentEnv.status === "running" ? "运行中" : "已停止"}`;
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
  }

  _renderEnvItem(env) {
    const isCurrent = env.id === this.currentEnvId;
    const isRunning = env.status === "running";
    const envName = env.name || env.apiBaseUrl || "未命名环境";
    const isSwitching = this.isSwitching;

    let actionBtn = "";
    if (isCurrent && isRunning) {
      actionBtn = `<button class="item-action stop" data-env-id="${env.id}" ${isSwitching ? "disabled" : ""}>停止</button>`;
    } else if (isRunning) {
      actionBtn = `<button class="item-action" data-env-id="${env.id}" ${isSwitching ? "disabled" : ""}>切换</button>`;
    } else {
      actionBtn = `<button class="item-action" data-env-id="${env.id}" ${isSwitching ? "disabled" : ""}>启动</button>`;
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
    `;
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
    await Promise.all([this._fetchCurrentEnv(), this._fetchEnvList()]);
    this._updateUI();
  }

  _openDashboard() {
    // 打开管理页面的新标签页
    // 使用当前页面的同源 URL 拼接 API 前缀，PreProxyServer 会自动代理到 PostProxyServer
    window.open(`${API_PREFIX}`, "_blank");
  }

  async _handleEnvAction(env) {
    if (this.isSwitching) return;

    const currentEnv = this.envList.find((e) => e.id === this.currentEnvId);
    const isCurrentRunning =
      currentEnv && currentEnv.status === "running" && this.currentEnvId === env.id;
    const isTargetRunning = env.status === "running";

    // 如果是当前运行中的环境 → 停止
    if (isCurrentRunning) {
      await this._doStop(env);
      return;
    }

    // 如果目标环境已在运行 → 直接跳转，无需重新启动
    if (isTargetRunning) {
      this._redirectTo(env);
      return;
    }

    // 目标环境未运行 → 启动后跳转
    await this._doSwitch(env);
  }

  async _doStop(env) {
    this.isSwitching = true;
    this._updateUI();

    try {
      await this._stopEnv(env.id);
      await this._refresh();
    } catch (err) {
      this._showToast(`停止失败: ${err.message}`);
    } finally {
      this.isSwitching = false;
      this._updateUI();
    }
  }

  async _doSwitch(targetEnv) {
    this.isSwitching = true;
    this._updateUI();

    try {
      // 只启动目标环境，不关闭当前环境
      await this._startEnv(targetEnv.id);

      // 启动成功后重定向到新环境的代理 URL
      this._redirectTo(targetEnv);
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
