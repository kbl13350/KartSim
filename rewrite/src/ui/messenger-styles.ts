/**
 * Styles of the DOM messenger window (messenger-dom.ts). The window lives on
 * a 1600×900 stage scaled into the game root like the BML window renderer's
 * canvas; the layer ignores the pointer outside the window so the lobby and
 * the taskbar under it stay usable. Layer: [data-ui-layer=dialog] (z 3),
 * above the lobby and taskbar, under notices; modal dialogs opened later sit
 * above it.
 */
export const MESSENGER_STYLES = `
.ks-msgr{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:#fff;
  --ks-msgr-font:"KartSim Shop SourceHanSansCN","Source Han Sans SC","Noto Sans CJK SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-family:var(--ks-msgr-font);-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.ks-msgr *,.ks-msgr *::before,.ks-msgr *::after{box-sizing:border-box}
.ks-msgr [hidden]{display:none!important}
.ks-msgr-stage{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;
  transform:scale(var(--ks-msgr-sx,1),var(--ks-msgr-sy,1));pointer-events:none}
.ks-m{position:absolute;margin:0;padding:0;border:0;background:transparent;color:var(--c0,#fff);isolation:isolate;
  font:700 var(--fz,12px)/1.2 var(--ks-msgr-font);text-align:left;pointer-events:none;outline:none;
  -webkit-appearance:none;appearance:none;overflow:visible}
.ks-msgr-window{pointer-events:none}
.ks-msgr :is(button.ks-m,.ks-m-row,.ks-m-input,.ks-m-list,.ks-m-scroll,.ks-m-thumb,[data-name=mainBlock],.ks-m-Window,.ks-m-popup){pointer-events:auto}
.ks-msgr button.ks-m{cursor:pointer}
.ks-msgr button.ks-m:disabled{cursor:default}
.ks-msgr button.ks-m:focus-visible{outline:1px dotted rgba(255,255,255,.7);outline-offset:-2px}

/* Text: textRender size, textAlign, stringPos; | breaks lines. */
.ks-m-text{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;
  padding:var(--sy,0px) 0 0 var(--sx,0px);font-size:var(--fz,12px);line-height:1.2;white-space:pre;
  pointer-events:none;color:inherit;z-index:1}
.ks-m[data-align=center]>.ks-m-text{justify-content:center;text-align:center}
.ks-m[data-align=right]>.ks-m-text{justify-content:flex-end;text-align:right}
.ks-m[data-valign=center]>.ks-m-text{align-items:center}
.ks-m[data-wrap=true]>.ks-m-text{white-space:pre-wrap;word-break:break-all}
.ks-m[data-outline=true]>.ks-m-text{text-shadow:1px 0 var(--oc,#000),-1px 0 var(--oc,#000),0 1px var(--oc,#000),0 -1px var(--oc,#000)}
.ks-m-runs{display:block}

/* State colours (textColor, overTextColor, clickedTextColor, disabledTextColor). */
.ks-msgr :is(button.ks-m:hover:not(:disabled),.ks-m-row:hover){color:var(--c1,var(--c0,#fff))}
.ks-msgr :is(button.ks-m:active:not(:disabled),.ks-m[aria-selected=true]){color:var(--c2,var(--c0,#fff))}
.ks-msgr button.ks-m:disabled{color:var(--c3,var(--c0,#fff))}

/* Texture stretched over the node; ImageButton states centred at natural size. */
.ks-m-tex{background:var(--i0) 0 0/100% 100% no-repeat}
.ks-m-img{position:absolute;left:50%;top:50%;width:var(--iw);height:var(--ih);transform:translate(-50%,-50%);
  background:var(--i1) 0 0/100% 100% no-repeat;pointer-events:none;z-index:-1}
.ks-msgr :is(button.ks-m:hover:not(:disabled),.ks-m-row:hover)>.ks-m-img{background-image:var(--i2,var(--i1))}
.ks-msgr :is(button.ks-m:active:not(:disabled),.ks-m[aria-selected=true])>.ks-m-img{background-image:var(--i3,var(--i1))}
.ks-msgr button.ks-m:disabled>.ks-m-img{background-image:var(--i4,var(--i1))}
/* ImageCheckButton list_check_01..05: off, on, on+over, off+over, disabled. */
.ks-msgr .ks-m-ImageCheckButton>.ks-m-img{background-image:var(--i1)}
.ks-msgr .ks-m-ImageCheckButton:hover:not(:disabled)>.ks-m-img{background-image:var(--i4,var(--i1))}
.ks-msgr .ks-m-ImageCheckButton[aria-checked=true]>.ks-m-img{background-image:var(--i2,var(--i1))}
.ks-msgr .ks-m-ImageCheckButton[aria-checked=true]:hover:not(:disabled)>.ks-m-img{background-image:var(--i3,var(--i2,var(--i1)))}
.ks-msgr .ks-m-ImageCheckButton:disabled>.ks-m-img{background-image:var(--i5,var(--i1))}

/* Frames painted at the node size: normal, over, clicked, disabled. */
.ks-m-frame{background:var(--f0) 0 0/100% 100% no-repeat}
.ks-msgr button.ks-m-frame:hover:not(:disabled){background-image:var(--f1,var(--f0))}
.ks-msgr button.ks-m-frame:active:not(:disabled){background-image:var(--f2,var(--f1,var(--f0)))}
.ks-msgr button.ks-m-frame:disabled{background-image:var(--f3,var(--f0))}

.ks-m-input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0 2px;border:0;background:transparent;
  font:700 var(--fz,14px)/1 var(--ks-msgr-font);outline:none;-webkit-user-select:text;user-select:text}
.ks-m-input:disabled{opacity:.6}

/* GridSelector lists: native scrolling, the original ScrollBar drawn beside. */
.ks-m-list{overflow-x:hidden;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain}
.ks-m-list::-webkit-scrollbar{display:none}
.ks-msgr .ks-m-row-root{position:relative!important;left:0!important;top:0!important;display:block}
.ks-m-row{cursor:default}
.ks-m-scroll{background:var(--f0) 0 0/100% 100% no-repeat}
.ks-m-thumb{position:absolute;left:0;width:100%;background:var(--t0) 0 0/100% 100% no-repeat;cursor:pointer}
.ks-m-thumb:hover,.ks-m-thumb[data-drag=true]{background-image:var(--t1,var(--t0))}

/* Chat log (chatHistory): plain lines on the white page, newest at the bottom. */
.ks-m-chatlog{padding:2px 6px 4px 4px;color:rgb(42,55,80);font:700 14px/19px var(--ks-msgr-font);
  white-space:pre-wrap;word-break:break-all;-webkit-user-select:text;user-select:text}
.ks-m-line{margin:0 0 3px}
.ks-m-line-name{color:rgb(13,153,225)}
.ks-m-line[data-self=true] .ks-m-line-name{color:rgb(95,160,0)}
.ks-m-line[data-kind=system]{color:rgb(135,146,167)}
.ks-m-line[data-kind=system][data-tone=warning]{color:rgb(229,41,37)}
.ks-m-line[data-kind=pending]{opacity:.6}
.ks-m-line[data-failed=true]{color:rgb(229,41,37);opacity:1}
.ks-m-line-time{color:rgb(168,183,195);font-size:12px;margin-left:6px}
.ks-m-emo{display:inline-block;width:20px;height:18px;vertical-align:-3px;background-repeat:no-repeat}
.ks-m-more{display:block;width:100%;margin:2px 0 6px;padding:0;border:0;background:none;color:rgb(135,146,167);
  font:700 13px/18px var(--ks-msgr-font);text-align:center;cursor:pointer;pointer-events:auto}
.ks-m-more:hover{color:rgb(13,153,225)}

/* Quick menus and the status drop box (DropBoxBg windows). */
.ks-msgr .ks-m-Window>button.ks-m>.ks-m-text{white-space:pre}

/* The tooltip label (DefaultTooltipNew, autoSizing). */
.ks-m-tooltip{position:absolute;z-index:10;padding:3px 9px 5px;color:rgb(241,244,248);font:700 14px/18px var(--ks-msgr-font);
  white-space:pre;pointer-events:none;background:var(--f0) 0 0/100% 100% no-repeat}

/* Emoticon panel (selectEmoticon). */
.ks-m-emopanel{position:absolute;z-index:5;pointer-events:auto}
.ks-m-emopanel>button{position:absolute;width:24px;height:22px;padding:2px;border:0;background:none;cursor:pointer}
.ks-m-emopanel>button:hover{background:rgba(255,255,255,.25)}
.ks-m-emopanel>button>span{display:block;width:20px;height:18px;background-repeat:no-repeat}

/* Plain look while (or when) the original art is missing. */
.ks-msgr:not([data-art]) [data-name=messenger_bg]{background:#fff;box-shadow:inset 0 0 0 1px #000}
`;
