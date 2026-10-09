/**
 * Shop styles. Every original element is an absolutely positioned
 * .ks-bml node at its BML rectangle on the shop's screen (shop-widgets.ts):
 * 1080 pixels high and --ks-shop-w wide, scaled by --ks-shop-scale
 * (viewport height / 1080) into the root like the PC client scales its UI.
 * The art arrives as CSS custom properties (shop-assets.ts); without it the
 * plain fallbacks below keep the shop usable.
 *
 * Layering: z-index 3 is the app's [data-ui-layer=dialog] layer, above the
 * lobby and taskbar (2), below notices (4). The overlay itself ignores the
 * pointer so the taskbar strip the host leaves free (--ks-shop-taskbar, the
 * original stage keeps its tray under the shop) stays usable; the stage
 * scene above it catches every other click, and the modal layer covers all.
 * Over the home lobby the scene is transparent: the live lobby shows through.
 */

const OUTLINE = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
  .map(([x, y]) => `${x}px ${y}px 0 var(--oc)`).join(",");

const frameState = (selector: string, slot: number) => `
${selector}::before{border-width:var(--fw${slot},var(--fw0));border-image-source:var(--f${slot},var(--f0));
  border-image-slice:var(--fs${slot},var(--fs0));border-image-width:var(--fw${slot},var(--fw0))}`;

export const SHOP_STYLES = `
.ks-shop{position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none;color:#fff;
  --ks-shop-font-bold:"KartSim Shop SourceHanSansCN","Source Han Sans SC","Noto Sans CJK SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --ks-shop-font-plain:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif;
  font-family:var(--ks-shop-font-bold);font-weight:700;font-size:12px;line-height:1.25;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.ks-shop *,.ks-shop *::before,.ks-shop *::after{box-sizing:border-box}
.ks-shop:focus{outline:none}
.ks-shop [hidden]{display:none!important}
.ks-shop :focus-visible{outline:2px solid #ffe66b;outline-offset:1px}
.ks-shop-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ks-shop-stage{position:absolute;left:0;top:0;width:var(--ks-shop-w,1920px);height:1080px;transform-origin:0 0;
  transform:scale(var(--ks-shop-scale,1));pointer-events:none}

/* MqShopStage scene: the lobby world behind, the rider and kart on the left. */
.ks-shop-scene{position:absolute;left:0;top:0;width:100%;height:calc(1080px - var(--ks-shop-taskbar,0px));
  overflow:hidden;pointer-events:auto;background:linear-gradient(180deg,#7fb7e2 0%,#a9d1ef 46%,#cfd8de 47%,#9aa7b2 100%)}
.ks-shop-scene[data-backdrop=lobby]{background:none}
.ks-shop-scene[data-backdrop=still]{background:#0b1426}
.ks-shop-backdrop{position:absolute;left:0;top:0;width:100%}
.ks-shop-rider{position:absolute;overflow:visible;pointer-events:auto;touch-action:none;cursor:grab}
.ks-shop-rider:active{cursor:grabbing}
.ks-shop-rider-view{position:absolute;inset:0;transform-origin:50% 60%}
.ks-shop-rider-view>canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}

/* The lobby top bar the host draws when the lobby's own is not in view (ui/lobby-top-bar). */
.ks-shop-topbar{position:absolute;left:0;top:0;width:100%;container-type:size;pointer-events:none;
  font-weight:400;font-size:16px;line-height:normal;text-align:left}
.ks-shop-topbar .ks-lobby-top{pointer-events:auto}

/* Original BML nodes. */
.ks-bml{position:absolute;margin:0;padding:0;border:0;background:transparent;color:var(--c0,#fff);
  font:inherit;text-align:left;pointer-events:none;-webkit-appearance:none;appearance:none}
.ks-shop :is(button.ks-bml,.ks-edit-input,.ks-shop-card,.ks-shop-grid,.ks-shop-scroll,[data-name=shopItems],.ks-shop-spend){pointer-events:auto}
button.ks-bml{cursor:pointer}
button.ks-bml:disabled{cursor:default}
.ks-bml[data-inert=true]{pointer-events:none}
.ks-text{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;
  padding:var(--sy,0px) 0 0 var(--sx,0px);font-family:var(--ff,var(--ks-shop-font-bold));font-size:var(--fz,12px);
  font-weight:700;line-height:1.25;white-space:pre;overflow:visible;color:inherit;pointer-events:none}
.ks-bml[data-align=center]>.ks-text{justify-content:center;text-align:center}
.ks-bml[data-align=right]>.ks-text{justify-content:flex-end;text-align:right}
.ks-bml[data-valign=center]>.ks-text{align-items:center}
.ks-bml[data-wrap=true]>.ks-text{white-space:pre-wrap;word-break:break-all;display:block}
.ks-bml[data-stroke=true]>.ks-text{text-shadow:${OUTLINE};letter-spacing:1.5px}
/* The CN FtFonts sit their glyphs a little lower in a top-aligned box than CSS does. */
.ks-bml[data-valign=top]>.ks-text{transform:translateY(2px)}
.ks-bml[data-face=plain]>.ks-text{font-weight:400}
button.ks-bml:hover:not(:disabled,[aria-disabled=true]){color:var(--c1,var(--c0,#fff))}
button.ks-bml:active:not(:disabled,[aria-disabled=true]){color:var(--c2,var(--c0,#fff))}
button.ks-bml:disabled,.ks-bml[aria-selected=true]{color:var(--c3,var(--c0,#fff))}
button.ks-bml[aria-disabled=true]>.ks-text{opacity:.55}
.ks-tex{background:var(--i0) 0 0/100% 100% no-repeat}
.ks-ib{background:var(--i1) center/auto no-repeat}
button.ks-ib:hover:not(:disabled){background-image:var(--i2,var(--i1))}
button.ks-ib:active:not(:disabled){background-image:var(--i3,var(--i1))}
button.ks-ib:disabled{background-image:var(--i4,var(--i1))}
.ks-frame::before{content:"";position:absolute;inset:0;pointer-events:none;border-style:solid;border-color:transparent;
  border-width:var(--fw0);border-image-source:var(--f0);border-image-slice:var(--fs0);border-image-width:var(--fw0);
  border-image-repeat:stretch;z-index:-1}
.ks-frame{isolation:isolate}
${frameState("button.ks-frame:hover:not(:disabled,[aria-selected=true])", 1)}
${frameState("button.ks-frame:active:not(:disabled,[aria-selected=true])", 2)}
${frameState("button.ks-frame:disabled", 3)}
${frameState(".ks-frame[aria-selected=true]", 3)}
.ks-bullet{border-radius:0}
.ks-caption-text{right:auto;bottom:auto;align-items:center;justify-content:center;color:#fff}
.ks-bml-Edit>.ks-edit-input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0 6px;border:0;background:transparent;
  color:#2a3750;font:400 12px/22px var(--ks-shop-font-plain);outline:none;-webkit-user-select:text;user-select:text}

/* Plain fallbacks while (or when) the original art is missing. */
.ks-shop:not([data-art]) [data-name=shopItems]{background:rgba(32,38,48,.92);box-shadow:inset 0 0 0 2px #0e1218}
.ks-shop:not([data-art]) .ks-shop-card{background:#f2f5fa;box-shadow:inset 0 30px 0 #ffde00,inset 0 0 0 1px #8a95a6}
.ks-shop:not([data-art]) .ks-shop-card[data-currency=lucci]{box-shadow:inset 0 30px 0 #5fb2f5,inset 0 0 0 1px #8a95a6}
.ks-shop:not([data-art]) .ks-shop-card[data-currency=koin]{box-shadow:inset 0 30px 0 #9ad04e,inset 0 0 0 1px #8a95a6}
.ks-shop:not([data-art]) .ks-shop-dialog{background:#eef2f7;color:#2a3750}

/* Tabs: the selected tab and sub-tab show their disabled (clicked) state; empty ones are dimmed. */
.ks-shop-tab[aria-disabled=true]{cursor:default}
.ks-shop-subtab>.ks-text{overflow:hidden}
.ks-shop-subtab[aria-disabled=true]{cursor:default}

/* Card grid (itemList GridSelectorDivLoad). */
.ks-shop-grid{overflow:visible}
.ks-shop-card{position:absolute;width:230px;height:194px;background:var(--i1) 0 0/100% 100% no-repeat;pointer-events:auto}
.ks-shop-card:is(:hover,:has(:focus-visible),[data-active=true]){background-image:var(--i2,var(--i1))}
.ks-shop-card[data-pressed=true]{background-image:var(--i3,var(--i1))}
.ks-shop-card[data-owned=forever]{background-image:var(--i4,var(--i1))}
.ks-shop-card-face{inset:0;width:100%!important;height:100%!important;left:0!important;top:0!important;background:none!important}
.ks-shop-card-face>.ks-text{left:6px;right:6px;overflow:hidden;text-overflow:ellipsis;display:block;text-align:center;
  padding-top:var(--sy,10px);white-space:nowrap}
.ks-shop-card .ks-card-action{visibility:hidden}
.ks-shop-card:is(:hover,:has(:focus-visible),[data-active=true]) .ks-card-action{visibility:visible}
.ks-shop-card:is(:hover,:has(:focus-visible),[data-active=true]) .ks-card-price-row{visibility:hidden}
.ks-shop-card .ks-card-detail{z-index:1}
.ks-shop-art{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#7c8aa0;pointer-events:none}
.ks-shop-art-icon{width:64px;height:48px;opacity:.8}
.ks-shop-art[data-preview=ready]>.ks-shop-art-icon{display:none}
.ks-shop-art>canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
/* Card ItemWindows draw karts smaller than the garage card camera frames them. */
.ks-shop-card .ks-shop-art[data-group=kart]>canvas{transform:translate(-50%,-50%) scale(.82)}
.ks-shop-art-kind{position:absolute;left:0;right:0;bottom:2px;text-align:center;font:400 12px var(--ks-shop-font-plain);color:#7c8aa0}
.ks-shop-art[data-preview=ready]>.ks-shop-art-kind{display:none}
/* eventTag: the mark's two frames alternate; a discount flag carries its N折 (discountVal). */
.ks-shop-mark{position:absolute;left:0;top:0;background:var(--mark) 0 0/200% 100% no-repeat;animation:ks-shop-blink .8s steps(1) infinite}
@keyframes ks-shop-blink{50%{background-position:100% 0}}
.ks-shop-mark-label>.ks-text{white-space:nowrap;letter-spacing:2px}
.ks-card-price-row .ks-text{white-space:nowrap}

/* The grid's scrollbar (itemListBar). */
.ks-shop-scroll-thumb{position:absolute;left:0;width:100%;pointer-events:auto;cursor:pointer}

/* Search (searchBtn, searchEdit, searchEditTooltip). */
[data-name=searchEditTooltip]>.ks-text{padding:6px 8px;color:#fff;white-space:normal}

/* Status over the grid: loading, errors, nothing found. */
.ks-shop-status{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  pointer-events:auto;color:#dfe6f0;font-size:16px;text-align:center}
.ks-shop-status-button{position:relative!important;width:132px;height:42px}
.ks-shop-spinner{width:36px;height:36px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:#ffe66b;animation:ks-shop-spin 1s linear infinite}
@keyframes ks-shop-spin{to{transform:rotate(360deg)}}

/* Tooltip (shopCardTip). */
.ks-shop-tooltip{z-index:5;pointer-events:none}
.ks-shop-tip-flow{position:absolute;display:flex;flex-direction:column;gap:5px}
.ks-shop-tip-flow>*{position:relative!important;left:auto!important;top:auto!important;height:auto!important}
.ks-shop-tip-flow .ks-text{position:relative;display:block;white-space:pre-wrap;word-break:break-all;inset:auto}
.ks-shop-tip-stocks .ks-text{position:relative;display:block;white-space:pre}
.ks-shop-tip-owned{color:#8be28b;font-size:12px;white-space:pre-wrap}

/* 累计消费活动 (tcCashWindow@zz at tcCashWndPos). */
.ks-shop-spend{z-index:1}
.ks-shop-spend-step{position:absolute;width:80px;height:80px}
.ks-shop-spend-step button.ks-bml:disabled{cursor:default}
.ks-shop-spend-item .ks-shop-art{color:#a7b6cf}
.ks-shop-spend-item .ks-shop-art-icon{width:44px;height:33px;opacity:.9}
.ks-shop-spend-item .ks-shop-art>canvas{max-width:70px;max-height:70px}

/* Toast. */
.ks-shop-toast{position:absolute;left:990px;top:521px;width:520px;min-height:52px;z-index:6;display:flex;align-items:center;
  justify-content:center;padding:14px 22px;text-align:center;font-size:16px;color:#fff;opacity:0;transition:opacity .2s;pointer-events:none}
.ks-shop-toast[data-show=true]{opacity:1}
.ks-shop-toast>span{position:relative}

/* Modal layer (dialog2_buyItem), over the whole screen. */
.ks-shop-modal-layer{position:absolute;left:0;top:0;width:100%;height:1080px;z-index:10;pointer-events:none}
.ks-shop-modal{pointer-events:auto}
.ks-shop-dialog{pointer-events:auto}
.ks-shop-dialog .ks-shop-art{inset:0}
.ks-shop-dialog-name>.ks-text{right:0;overflow:hidden;text-overflow:ellipsis;display:block;line-height:20px}
.ks-shop-dialog-amount{color:rgb(42,55,80)}
.ks-shop-dialog-amount[data-negative=true]{color:#ff4545}
.ks-shop-dialog-note[data-warning=true]{color:#e0452b}
.ks-shop-dialog-message>.ks-text{white-space:pre-wrap}
.ks-shop-dialog-message[data-kind=error]{color:#e0452b}
.ks-shop-dialog-message[data-kind=success]{color:#1a7f37}
.ks-shop-dialog-message[data-kind=busy]{color:#486aa3}
.ks-shop-combo>.ks-text{padding-left:8px;padding-right:28px;overflow:hidden;color:#2a3750;font-size:14px}
.ks-shop-combo-arrow{position:absolute;right:3px;top:3px;width:20px;height:20px;pointer-events:none}
.ks-shop-combo-arrow-icon{position:absolute;left:2px;top:2px;width:16px;height:16px;background:var(--ks-i-dropDownButton) 0 0/64px 32px no-repeat}
.ks-shop-combo-list{position:absolute;z-index:3;overflow-y:auto;overflow-x:hidden;pointer-events:auto;padding:6px 6px}
.ks-shop-combo-list::-webkit-scrollbar{width:8px}
.ks-shop-combo-list::-webkit-scrollbar-thumb{background:#9aa9c0;border-radius:4px}
.ks-shop-combo-option{position:relative!important;display:block;width:100%!important;height:22px!important;left:auto!important;top:auto!important}
.ks-shop-combo-option>.ks-text{padding-left:6px;font-size:13px;color:#3c3c3c;font-weight:400;font-family:var(--ks-shop-font-plain)}
.ks-shop-combo-option[aria-selected=true]::before{border-width:var(--fw1);border-image-source:var(--f1);border-image-slice:var(--fs1);border-image-width:var(--fw1)}
.ks-shop-combo-option[data-blocked]:not([data-blocked=""])>.ks-text{color:#c0392b}
@media (prefers-reduced-motion:reduce){.ks-shop-mark,.ks-shop-spinner{animation:none}.ks-shop-toast{transition:none}}
`;
