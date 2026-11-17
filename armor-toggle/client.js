(() => {
  try {
    /* 破甲 (armor-toggle) client half — v6.1.0
     *
     * 标题栏上的「破甲」药丸开关：胶囊轨道 + 圆点滑块，点一下切换。
     *
     * 语义：
     *   开 = 破甲生效（三层提示词 + 五道闸）
     *   关 = 完全无破甲，跟没装这个插件一样
     *   默认关。点一下切换，状态立刻下发宿主，不需要重启。
     *
     * ⚠ v6.1.0 通信层重写（这一段是重点，改前先读）：
     *   client 跑在**浏览器页面**，host 跑在**Node 进程** —— 独立的 JS 运行时，
     *   `globalThis` 不共享。旧版用 `window.__armorToggle` 做通道是架构性错误：
     *   宿主写的是 Node 的 globalThis，浏览器里永远是 undefined，
     *   点击在 `if (!service) return` 处静默返回 —— 这就是「点下去没反应」。
     *   现在改走同源 HTTP：`GET/POST /armor-toggle/state`。
     */
    window.__ModuleLoader__.load({
      id: "armor-toggle",
      factory: (require) => {
        var module = { exports: {} };
        var exports = module.exports;
        Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

        var react = require("react");
        var inject = ["slots"];

        /* ================================================================
         * 参数
         * ================================================================ */
        var PILL_GAP = 8;              // 药丸与「编辑」右边缘的间距
        var PILL_FALLBACK_LEFT = 200;  // 找不到菜单时的兜底横向位置
        var PILL_HEIGHT = 24;          // 整体高度
        var TRACK_W = 38;              // 胶囊轨道宽
        var TRACK_H = 20;              // 胶囊轨道高
        var KNOB = 16;                 // 滑块直径
        var STORE_KEY = "armor-toggle:enabled";
        var BRIDGE = "/armor-toggle/state";
        var POLL_MS = 3000;            // 与宿主状态对账的轮询间隔

        /* ================================================================
         * 定位：贴靠 Windows 顶栏「编辑」按钮
         *
         * DSH 桌面端 Windows 的顶栏菜单由 preload 层绘制 ——
         * document.body 下一个 [data-windows-menu] 宿主 + shadow DOM，
         * 里面两个按钮 application / edit（中文「应用」「编辑」）。
         * 那段代码在 contextIsolation 沙箱里，不在 Cordis 插槽树上，
         * shell.leading 官方座位又只在 macOS 侧栏收起时挂载，
         * 所以只能在页面层用 fixed 定位贴靠过去。
         * ================================================================ */

        /** 找到「编辑」按钮的右边缘 x 坐标；找不到返回 null。 */
        function findEditRight() {
          try {
            var host = document.querySelector("[data-windows-menu]");
            if (!host) return null;
            var root = host.shadowRoot;
            if (!root) return null;
            var items = root.querySelectorAll("[role='menuitem']");
            if (items.length < 2) return null;
            var editBtn = items[1];  // [0]=application, [1]=edit
            var rect = editBtn.getBoundingClientRect();
            if (!rect || rect.width === 0) return null;
            // 几何值必须校验，否则会拼出 "NaNpx" / "Infinitypx" 这种非法 CSS
            if (!Number.isFinite(rect.right)) return null;
            if (rect.right < 0) return null;
            return rect.right;
          } catch (e) {
            return null;
          }
        }

        /** 顶栏垂直中心；拿不到就用固定值 20（顶栏高 40 的一半）。 */
        function titlebarCenter() {
          try {
            var h = getComputedStyle(document.documentElement)
              .getPropertyValue("--dsh-windows-titlebar-height");
            var px = parseFloat(h);
            if (isFinite(px) && px > 0) return px / 2;
          } catch (e) { /* 忽略 */ }
          return 20;
        }

        /** 当前是否处于 Windows 桌面顶栏环境。 */
        function isWindowsDesktop() {
          try {
            return document.documentElement.hasAttribute("data-windows-titlebar");
          } catch (e) {
            return false;
          }
        }

        /* ================================================================
         * 与宿主通信（同源 HTTP）
         * ================================================================ */

        /** 读宿主当前状态；失败返回 null（调用方保持现状）。 */
        function bridgeGet() {
          try {
            return fetch(BRIDGE, {
              method: "GET",
              headers: { accept: "application/json" },
              credentials: "same-origin",
              cache: "no-store"
            }).then(function (r) {
              if (!r.ok) return null;
              return r.json();
            }).then(function (j) {
              if (!j || j.ok !== true) return null;
              return j.enabled === true;
            }).catch(function () { return null; });
          } catch (e) {
            return Promise.resolve(null);
          }
        }

        /** 写宿主状态；返回宿主确认后的值，失败返回 null。 */
        function bridgeSet(enabled) {
          try {
            return fetch(BRIDGE, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ enabled: enabled === true })
            }).then(function (r) {
              if (!r.ok) return null;
              return r.json();
            }).then(function (j) {
              if (!j || j.ok !== true) return null;
              return j.enabled === true;
            }).catch(function () { return null; });
          } catch (e) {
            return Promise.resolve(null);
          }
        }

        /* ================================================================
         * 药丸开关组件
         * ================================================================ */
        function ArmorPill(props) {
          var rc = (props && props.react) || react;

          // mode 三态（v6.2.0）：
          //   "hidden"   还没算出位置 / 桌面端但菜单尚未挂载 → 不渲染
          //   "titlebar" 桌面端且找到「编辑」按钮 → 贴它右边（原始需求）
          //   "floating" 非桌面端（浏览器打开）→ 固定右上角兜底
          //
          // 为什么要兜底：原来只有一个 mounted 布尔，要求「有 data-windows-titlebar」
          // 且「能找到编辑按钮」同时成立，否则组件直接 return null ——
          // 结果在浏览器里访问时药丸永远不出现，用户以为没装上。
          var statePair = rc.useState(function () {
            return {
              mode: "hidden",
              left: PILL_FALLBACK_LEFT,
              top: titlebarCenter(),
              enabled: false,
              reachable: true      // 宿主桥是否可达（不可达时药丸仍显示，只是不联动）
            };
          });
          var state = statePair[0];
          var setState = statePair[1];

          // 用 ref 保存最新 enabled，供轮询回调读，避免闭包取到旧值
          var enabledRef = rc.useRef(false);
          enabledRef.current = state.enabled;

          /* ---- 位置跟随：窗口缩放 / DOM 变化 / 尺寸变化 / 低频兜底 ---- */
          rc.useEffect(function () {
            if (typeof window === "undefined") return undefined;

            var raf = 0;
            var lastRun = 0;
            var sync = function () {
              if (raf) return;
              // 节流 80ms：MutationObserver 盯的是 body subtree，
              // 对话流式输出时每秒几十次变更，不节流会把 rAF 打满。
              var now = Date.now();
              if (now - lastRun < 80) return;
              lastRun = now;
              raf = window.requestAnimationFrame(function () {
                raf = 0;
                var right = findEditRight();
                var win = isWindowsDesktop();

                var mode, left, top;
                if (win && right !== null) {
                  mode = "titlebar";
                  left = right + PILL_GAP;
                  top = titlebarCenter() - PILL_HEIGHT / 2;
                } else if (!win) {
                  // 非桌面端（浏览器 / 非 Windows）：固定右上角，保证能看见能用
                  mode = "floating";
                  left = -1;                      // 用 right 定位，left 不参与
                  top = 10;
                } else {
                  // 桌面端但菜单还没挂载：等，不闪一个错位的药丸
                  mode = "hidden";
                  left = PILL_FALLBACK_LEFT;
                  top = titlebarCenter() - PILL_HEIGHT / 2;
                }

                setState(function (prev) {
                  if (prev.mode === mode &&
                      Math.abs(prev.left - left) < 0.5 &&
                      Math.abs(prev.top - top) < 0.5) {
                    return prev;
                  }
                  return {
                    mode: mode,
                    left: left,
                    top: top,
                    enabled: prev.enabled,
                    reachable: prev.reachable
                  };
                });
              });
            };

            sync();

            window.addEventListener("resize", sync, { passive: true });
            var mo = null;
            try {
              mo = new MutationObserver(sync);
              mo.observe(document.body, { childList: true, subtree: true });
            } catch (e) { /* 忽略 */ }

            var ro = null;
            try {
              ro = new ResizeObserver(sync);
              ro.observe(document.documentElement);
            } catch (e) { /* 忽略 */ }

            var timer = window.setInterval(sync, 1000);

            return function () {
              window.removeEventListener("resize", sync);
              if (mo) mo.disconnect();
              if (ro) ro.disconnect();
              window.clearInterval(timer);
              if (raf) window.cancelAnimationFrame(raf);
            };
          }, []);

          /* ---- 启动对齐 + 低频对账 ---- */
          rc.useEffect(function () {
            if (typeof window === "undefined") return undefined;
            var alive = true;

            var apply = function (value) {
              if (!alive || value === null) return;
              var v = value === true;
              setState(function (prev) {
                if (prev.enabled === v && prev.reachable === true) return prev;
                return {
                  mode: prev.mode,
                  left: prev.left,
                  top: prev.top,
                  enabled: v,
                  reachable: true
                };
              });
              try { localStorage.setItem(STORE_KEY, v ? "1" : "0"); } catch (e) { /* 忽略 */ }
            };

            var markUnreachable = function () {
              if (!alive) return;
              setState(function (prev) {
                return prev.reachable === false ? prev : {
                  mode: prev.mode, left: prev.left, top: prev.top,
                  enabled: prev.enabled, reachable: false
                };
              });
            };

            // 启动：localStorage 里有用户上次的选择就以它为准（下发宿主），
            // 否则读宿主当前值。
            var saved = null;
            try {
              var raw = localStorage.getItem(STORE_KEY);
              if (raw === "1") saved = true;
              else if (raw === "0") saved = false;
            } catch (e) { saved = null; }

            if (saved !== null) {
              bridgeSet(saved).then(function (v) {
                if (v === null) markUnreachable(); else apply(v);
              });
            } else {
              bridgeGet().then(function (v) {
                if (v === null) markUnreachable(); else apply(v);
              });
            }

            // 对账轮询：多窗口 / 宿主侧热重载后保持一致
            var poll = window.setInterval(function () {
              bridgeGet().then(function (v) {
                if (v === null) { markUnreachable(); return; }
                if (v !== enabledRef.current) apply(v);
              });
            }, POLL_MS);

            return function () {
              alive = false;
              window.clearInterval(poll);
            };
          }, []);

          /* ---- 点击切换 ---- */
          var onToggle = function (event) {
            try { event.preventDefault(); event.stopPropagation(); } catch (e) { /* 忽略 */ }
            var next = !state.enabled;
            // 乐观更新：先动 UI，宿主确认后以它为准
            setState(function (prev) {
              return {
                mode: prev.mode, left: prev.left, top: prev.top,
                enabled: next, reachable: prev.reachable
              };
            });
            try { localStorage.setItem(STORE_KEY, next ? "1" : "0"); } catch (e) { /* 忽略 */ }

            bridgeSet(next).then(function (v) {
              if (v === null) {
                setState(function (prev) {
                  return { mode: prev.mode, left: prev.left, top: prev.top,
                           enabled: prev.enabled, reachable: false };
                });
                return;
              }
              setState(function (prev) {
                return { mode: prev.mode, left: prev.left, top: prev.top,
                         enabled: v, reachable: true };
              });
            });
          };

          if (state.mode === "hidden") return null;

          var on = state.enabled;
          var floating = state.mode === "floating";

          /* ---- 外观：胶囊轨道 + 圆点滑块 ---- */
          var wrapStyle = {
            position: "fixed",
            // shell.overlay 这一层是 click-through 的，
            // 宿主给容器设了 pointer-events:none，条目必须自己 opt back in，
            // 否则药丸能显示但点不动。
            pointerEvents: "auto",
            // 桌面端贴「编辑」右边用 left；兜底模式固定右上角用 right
            left: floating ? "auto" : (state.left + "px"),
            right: floating ? "16px" : "auto",
            top: state.top + "px",
            height: PILL_HEIGHT + "px",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "0 8px 0 9px",
            borderRadius: "999px",
            border: "1px solid " + (on ? "rgba(34,197,94,.65)" : "rgba(148,163,184,.4)"),
            background: on ? "rgba(34,197,94,.13)" : "rgba(148,163,184,.10)",
            color: on ? "#4ade80" : "rgba(148,163,184,.95)",
            fontSize: "12px",
            lineHeight: "1",
            fontFamily: "inherit",
            cursor: "pointer",
            userSelect: "none",
            zIndex: 1200,
            transition: "background .18s ease, border-color .18s ease, color .18s ease",
            WebkitAppRegion: "no-drag",
            boxShadow: on ? "0 0 8px rgba(34,197,94,.35)" : "none"
          };

          var labelStyle = {
            fontWeight: 600,
            letterSpacing: ".5px",
            whiteSpace: "nowrap"
          };

          var trackStyle = {
            position: "relative",
            width: TRACK_W + "px",
            height: TRACK_H + "px",
            borderRadius: "999px",
            background: on ? "#22c55e" : "rgba(120,130,150,.55)",
            transition: "background .18s ease",
            flex: "none"
          };

          var knobStyle = {
            position: "absolute",
            top: "2px",
            left: on ? (TRACK_W - KNOB - 2) + "px" : "2px",
            width: KNOB + "px",
            height: KNOB + "px",
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.35)",
            transition: "left .18s ease"
          };

          var titleText = on
            ? "破甲已开启 · 点一下关闭"
            : (state.reachable ? "破甲已关闭 · 点一下开启" : "破甲已关闭（宿主未连通）· 点一下尝试开启");

          return rc.createElement(
            "button",
            {
              type: "button",
              style: wrapStyle,
              onClick: onToggle,
              title: titleText,
              "aria-pressed": on ? "true" : "false",
              "aria-label": "破甲开关",
              "data-plugin": "armor-toggle",
              "data-role": "titlebar-pill",
              "data-on": on ? "1" : "0",
              "data-reachable": state.reachable ? "1" : "0",
              "data-mode": state.mode
            },
            rc.createElement("span", { style: labelStyle }, "破甲"),
            rc.createElement(
              "span",
              { style: trackStyle, "aria-hidden": "true" },
              rc.createElement("span", { style: knobStyle })
            )
          );
        }

        /* ================================================================
         * 注册
         * ================================================================ */
        function apply(ctx) {
          ctx.slots.inject("shell.overlay", () =>
            ctx.slots.register({
              name: "shell.overlay",
              id: "armor-toggle:pill",
              order: -1000,
              label: "破甲开关"
            }, function ArmorPillSlot(props) {
              return react.createElement(ArmorPill, {
                react: react,
                slots: props
              });
            })
          );
        }

        exports.name = "armor-toggle";
        exports.inject = inject;
        exports.apply = apply;
        return module.exports;
      }
    });
  } catch (err) {
    console.warn('[AI Client Sandbox] armor-toggle runtime error:', err);
  }
})();
