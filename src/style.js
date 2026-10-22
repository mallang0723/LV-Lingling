// 령령의 제작실 (Lumiverse) — stylesheet. The original's CSS (Marinara variables, rem sizes down to 0.5rem, no 44px
// targets) is not reused; this one styles the same class names (mcs-* / mls-*) with Lumiverse's rules:
//  - text >= 15px (hints / counters >= 13px), every tap target >= 44px, a single scroll container (.mcs-main) so a touch
//    scroll in the window is never swallowed by a nested scroller,
//  - colours come from --ll-* (computed from the host theme in theme.js), never from --lumiverse-bg-opaque,
//  - layout follows the window's own width (container queries), because the window is a floating widget.
export const STYLE = `
.ll-root{container-type:inline-size;container-name:ll;box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;position:relative;background:var(--ll-bg);color:var(--ll-text);font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans KR','Apple SD Gothic Neo',sans-serif;border:1px solid var(--ll-line);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;user-select:text;-webkit-user-select:text;cursor:default;text-align:left}
.ll-root[data-full="1"]{border-radius:0;border:0;box-shadow:none}
.ll-root *{box-sizing:border-box}
.ll-root[data-mode=dark]{color-scheme:dark}
.ll-root[data-mode=light]{color-scheme:light}
.ll-root button,.ll-root input,.ll-root select,.ll-root textarea{font:inherit;color:inherit}
.ll-root svg{flex:none}
.ll-root .mcs-overlay{display:flex;flex-direction:column;flex:1;min-height:0;position:relative}
.ll-root .mcs-shell{display:flex;flex-direction:column;flex:1;min-height:0;position:relative}
/* header: the drag surface of the floating window */
.ll-root .mcs-shell-header{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--ll-line);background:var(--ll-soft);cursor:grab;touch-action:none;flex:none}
.ll-root .mcs-shell-header h1{margin:0;flex:1;min-width:0;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ll-root .mcs-studio-switcher{display:flex;gap:4px;flex:none}
.ll-root .mcs-studio-switcher__item{width:44px;height:44px;border-radius:12px;border:1px solid transparent;background:transparent;display:grid;place-items:center;cursor:pointer}
.ll-root .mcs-studio-switcher__item svg{width:20px;height:20px}
.ll-root .mcs-studio-switcher__item.is-selected{background:var(--ll-accent-soft);border-color:var(--ll-accent);color:var(--ll-accent-text)}
.ll-root .mcs-shell-header__actions{display:flex;gap:2px;flex:none}
/* buttons */
.ll-root .mcs-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--ll-line);background:var(--ll-soft-2);font-size:15px;font-weight:600;line-height:1.3;cursor:pointer;text-align:center}
.ll-root .mcs-button:disabled{opacity:.55;cursor:not-allowed}
.ll-root .mcs-button--primary{background:var(--ll-accent);border-color:var(--ll-accent);color:var(--ll-on-accent)}
.ll-root .mcs-button--secondary{background:var(--ll-soft)}
.ll-root .mcs-button--ghost{background:transparent;border-color:transparent}
.ll-root .mcs-button--icon-only{width:44px;padding:0}
.ll-root .mcs-button--wide{width:100%}
.ll-root .mcs-button svg{width:18px;height:18px}
.ll-root .mcs-button:not(:disabled):hover{filter:brightness(1.08)}
.ll-root :focus-visible{outline:2px solid var(--ll-accent-text);outline-offset:2px}
/* stepper */
.ll-root .mcs-stepper{display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid var(--ll-line);flex:none}
.ll-root .mcs-step{flex:1;min-width:0;min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;padding:4px 6px;border-radius:12px;border:1px solid transparent;background:transparent;font-size:15px;cursor:pointer}
.ll-root .mcs-step__number{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--ll-soft-2);font-size:13px;font-weight:700}
.ll-root .mcs-step__mobile{display:none}
.ll-root .mcs-step.is-current{background:var(--ll-accent-soft);border-color:var(--ll-accent);font-weight:700}
.ll-root .mcs-step.is-current .mcs-step__number{background:var(--ll-accent);color:var(--ll-on-accent)}
.ll-root .mcs-step.is-complete .mcs-step__number{background:var(--ll-accent-soft);color:var(--ll-accent-text)}
.ll-root .mcs-step:disabled{opacity:.5}
.ll-root .mcs-step-nav--previous svg{transform:rotate(180deg)}
/* the one scroller */
.ll-root .mcs-main{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:14px 14px 92px}
.ll-root .mcs-main > *{max-width:100%}
.ll-root .mcs-step-panel{display:flex;flex-direction:column;gap:14px;outline:none}
.ll-root .mls-lock{border:0;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;gap:14px}
.ll-root .mcs-section-heading{display:flex;flex-direction:column;gap:4px}
.ll-root .mcs-section-heading h2{margin:0;font-size:18px;line-height:1.35}
.ll-root .mcs-section-heading p{margin:0;font-size:15px;color:var(--ll-muted)}
.ll-root .mcs-heading-row{display:flex;flex-direction:column;gap:10px}
.ll-root .mcs-edit-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ll-root .mcs-heading-actions,.ll-root .mls-history-actions{display:flex;gap:6px}
.ll-root .mcs-form-flow{display:flex;flex-direction:column;gap:14px}
.ll-root .mcs-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.ll-root .mcs-label{font-size:15px;font-weight:600}
.ll-root .mcs-hint{margin:0;font-size:14px;color:var(--ll-muted)}
.ll-root .mcs-error{margin:0;font-size:14px;color:var(--ll-danger)}
.ll-root ul.mcs-error{padding-left:20px}
.ll-root .mcs-final-section{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--ll-line);padding-top:14px}
.ll-root .mcs-final-section h3{margin:0;font-size:16px}
.ll-root .mcs-final-section.mcs-no-bottom-divider:first-child,.ll-root .mcs-prepare-final-section{border-top:0;padding-top:0}
.ll-root .mcs-action-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ll-root .mcs-action-heading h3{margin:0;font-size:16px}
.ll-root .mcs-action-heading__buttons{display:flex;gap:2px}
/* fields */
.ll-root .mcs-input,.ll-root .mcs-textarea,.ll-root .mcs-select{width:100%;min-height:44px;padding:10px 12px;font-size:16px;line-height:1.45;border-radius:10px;border:1px solid var(--ll-line);background:var(--ll-soft);color:var(--ll-text);user-select:text;-webkit-user-select:text;touch-action:manipulation}
.ll-root .mcs-textarea{resize:vertical;display:block;min-width:0}
.ll-root .mcs-textarea--single{min-height:44px}
.ll-root .mcs-textarea[readonly]{background:var(--ll-soft-2)}
.ll-root .mcs-select{appearance:auto;padding-right:8px}
.ll-root input[type=checkbox]{width:22px;height:22px;flex:none;accent-color:var(--ll-accent);margin:0}
.ll-root .mcs-toggle-row,.ll-root .mcs-external-use,.ll-root .mcs-choice-row{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;font-size:15px}
.ll-root .mcs-choice-row{padding:4px 8px;border-radius:10px;border:1px solid transparent}
.ll-root .mcs-choice-row.is-selected{background:var(--ll-accent-soft);border-color:var(--ll-line)}
.ll-root .mcs-choice-row.is-disabled{opacity:.6}
.ll-root .mcs-choice-list{display:flex;flex-direction:column;gap:2px}
.ll-root .mcs-segmented{display:flex;gap:6px;flex-wrap:wrap}
.ll-root .mcs-segmented__item{flex:1;min-width:84px;min-height:44px;padding:6px 12px;border-radius:12px;border:1px solid var(--ll-line);background:var(--ll-soft);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;font-size:15px}
.ll-root .mcs-segmented__item small{font-size:13px;color:var(--ll-muted)}
.ll-root .mcs-segmented__item.is-selected{background:var(--ll-accent-soft);border-color:var(--ll-accent);font-weight:700}
.ll-root .mcs-two-column{display:grid;grid-template-columns:1fr;gap:14px}
@container ll (min-width:620px){.ll-root .mcs-two-column{grid-template-columns:auto 1fr;align-items:end}}
.ll-root .mcs-picker-fieldset{border:1px solid var(--ll-line);border-radius:12px;padding:10px 12px 12px;margin:0;min-width:0;display:flex;flex-direction:column;gap:10px}
.ll-root .mcs-picker-fieldset legend{padding:0 6px;font-size:15px;font-weight:600}
.ll-root .mcs-picker-actions{display:flex;flex-wrap:wrap;gap:8px}
.ll-root .mcs-selected-reference-list{display:flex;flex-wrap:wrap;gap:6px}
.ll-root .mcs-selected-reference{display:inline-flex;align-items:center;gap:2px;padding:0 0 0 12px;min-height:44px;border-radius:22px;background:var(--ll-accent-soft);border:1px solid var(--ll-line);font-size:15px}
.ll-root .mcs-world-selectors,.ll-root .mcs-persona-edit-selectors,.ll-root .mls-edit-source-row,.ll-root .mcs-existing-edit-fields,.ll-root .mls-edit-prepare{display:flex;flex-direction:column;gap:14px}
.ll-root .mcs-world-character-block,.ll-root .mcs-world-lorebook-block,.ll-root .mcs-world-persona-block{display:flex;flex-direction:column;gap:10px;min-width:0}
/* collapsibles */
.ll-root details{min-width:0}
.ll-root summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;font-weight:600;list-style-position:inside}
.ll-root .mcs-advanced,.ll-root .mcs-keyword-group,.ll-root .mcs-external-document,.ll-root .mcs-world-character-picker{border:1px solid var(--ll-line);border-radius:12px;padding:0 12px;background:var(--ll-soft)}
.ll-root .mcs-advanced__body,.ll-root .mcs-external-fields{display:flex;flex-direction:column;gap:10px;padding:2px 0 12px}
.ll-root .mcs-keyword-groups{display:flex;flex-direction:column;gap:8px}
.ll-root .mcs-keyword-summary-main{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.ll-root .mcs-keyword-summary-selected{display:flex;flex-wrap:wrap;gap:4px;font-weight:400;font-size:14px;color:var(--ll-accent-text)}
.ll-root .mcs-summary-count{font-size:13px;color:var(--ll-muted);font-weight:400;white-space:nowrap}
.ll-root .mcs-summary-count--has-selected{color:var(--ll-accent-text);font-weight:700}
.ll-root .mcs-chip-list{display:flex;flex-wrap:wrap;gap:6px;padding:2px 0 12px}
.ll-root .mcs-chip{min-height:44px;padding:6px 14px;border-radius:22px;border:1px solid var(--ll-line);background:var(--ll-bg);font-size:15px;cursor:pointer}
.ll-root .mcs-chip.is-selected{background:var(--ll-accent);border-color:var(--ll-accent);color:var(--ll-on-accent);font-weight:700}
.ll-root .mcs-external-panel{display:flex;flex-direction:column;gap:12px}
.ll-root .mcs-external-documents{display:flex;flex-direction:column;gap:10px}
.ll-root .mcs-external-summary{gap:8px}
.ll-root .mcs-external-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.ll-root .mcs-context-control{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.ll-root .mcs-context-help summary{width:44px;justify-content:center;border-radius:22px;border:1px solid var(--ll-line);background:var(--ll-soft);list-style:none}
.ll-root .mcs-context-help summary::-webkit-details-marker{display:none}
.ll-root .mcs-context-help__body{margin:6px 0 0;font-size:14px;color:var(--ll-muted)}
.ll-root .mcs-context-help{flex:0 0 auto}
.ll-root .mcs-context-help[open]{flex:1 0 100%}
.ll-root .mcs-help-label{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ll-root .mcs-help-label .mcs-context-help{flex:0 0 auto}
.ll-root .mcs-help-label .mcs-context-help__body{position:static}
.ll-root .mcs-length-help p{margin:2px 0}
/* editor sections (draft fields) */
.ll-root .mcs-editor-sections{display:flex;flex-direction:column;gap:8px}
.ll-root .mcs-editor-section{border:1px solid var(--ll-line);border-radius:12px;background:var(--ll-soft);padding:0 10px}
.ll-root .mcs-editor-section__toggle{width:100%;min-height:48px;display:flex;align-items:center;gap:8px;padding:4px 0;border:0;background:transparent;text-align:left;cursor:pointer;font-weight:600}
.ll-root .mcs-editor-section__chevron{display:grid;transition:transform .15s}
.ll-root .mcs-editor-section.is-open .mcs-editor-section__chevron{transform:rotate(90deg)}
.ll-root .mcs-editor-section__label{flex:1;min-width:0}
.ll-root .mcs-editor-section__status{font-size:13px;color:var(--ll-muted);font-weight:400;text-align:right}
.ll-root .mcs-editor-section__status.is-complete{color:var(--ll-accent-text)}
.ll-root .mcs-editor-section__body{display:flex;flex-direction:column;gap:10px;padding:0 0 12px}
.ll-root .mcs-editor-token-count,.ll-root .mcs-character-summary__token-total{font-size:13px;color:var(--ll-muted)}
.ll-root .mcs-token-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ll-root .mcs-token-settings{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--ll-line);border-radius:12px;background:var(--ll-soft)}
.ll-root .mcs-check-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.ll-root .mcs-check-list li{display:flex;justify-content:space-between;align-items:center;min-height:36px;padding:0 4px;border-bottom:1px solid var(--ll-line)}
.ll-root .mcs-check-list li.is-passed .mcs-check-status{color:var(--ll-accent-text);font-weight:700}
.ll-root .mcs-check-status{font-weight:700;color:var(--ll-danger)}
.ll-root .mcs-completion-actions{display:flex;flex-direction:column;gap:14px}
.ll-root .mcs-revision-quick-actions{display:inline-flex;gap:0}
.ll-root .mcs-revision-actions{display:flex}
.ll-root .mcs-edit-import-divider,.ll-root .mls-step-divider{height:1px;background:var(--ll-line)}
.ll-root .mcs-import-status{gap:6px}
.ll-root .mcs-briefing-preview{font-size:14px}
/* lorebook entries */
.ll-root .mls-entry-list{display:flex;flex-direction:column;gap:8px}
.ll-root .mls-entry{border:1px solid var(--ll-line);border-radius:12px;background:var(--ll-soft);padding:0 10px}
.ll-root .mls-entry-header{display:flex;align-items:center;gap:2px}
.ll-root .mls-entry-toggle{flex:1;min-width:0;justify-content:flex-start;text-align:left}
.ll-root .mls-entry-toggle span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ll-root .mls-entry-toggle.is-open svg{transform:rotate(90deg)}
.ll-root .mls-entry-body{display:flex;flex-direction:column;gap:10px;padding:2px 0 12px}
.ll-root .mls-content-label{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ll-root .mls-entry-move-row{display:flex;align-items:center;gap:4px;border:1px solid var(--ll-line);border-radius:12px;background:var(--ll-soft);padding:0 6px 0 12px}
.ll-root .mls-entry-move-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ll-root .mls-entry-add-row{display:flex;flex-wrap:wrap;gap:8px}
.ll-root .mls-message{padding:10px 12px;border-radius:10px;border:1px solid var(--ll-line);background:var(--ll-soft);margin-bottom:12px}
.ll-root .mls-token-area{display:flex;flex-direction:column;gap:8px}
.ll-root .mls-context-toggles{gap:6px}
/* notices */
.ll-root .mcs-toast{position:absolute;left:12px;right:12px;bottom:12px;z-index:3;display:flex;align-items:center;gap:6px;padding:4px 4px 4px 14px;border-radius:12px;background:var(--ll-text);color:var(--ll-bg);box-shadow:0 6px 24px rgba(0,0,0,.35);font-size:15px}
.ll-root .mcs-toast span{flex:1;min-width:0}
.ll-root .mcs-toast .mcs-button{color:var(--ll-bg)}
.ll-root .mcs-toast--error{background:var(--ll-danger);color:var(--ll-bg)}
/* the desktop resize grip (not shown on touch screens / full screen) */
.ll-root .mcs-resizer{display:none}
@media (pointer:fine){.ll-root:not([data-full="1"]) .mcs-resizer{display:block;position:absolute;right:0;bottom:0;width:22px;height:22px;cursor:nwse-resize;touch-action:none;background:linear-gradient(135deg,transparent 55%,var(--ll-line) 55%,var(--ll-line) 62%,transparent 62%,transparent 72%,var(--ll-line) 72%,var(--ll-line) 79%,transparent 79%);z-index:4}}
/* a narrow window (a phone, or a window dragged small) */
@container ll (max-width:560px){
  .ll-root .mcs-shell-header h1{display:none}
  .ll-root .mcs-shell-header{justify-content:space-between}
  .ll-root .mcs-step-nav{display:none}
  .ll-root .mcs-main{padding:12px 12px 92px}
  .ll-root .mcs-segmented__item{min-width:72px}
}
@container ll (max-width:400px){
  .ll-root .mcs-step__number{display:none}
  .ll-root .mcs-step{padding:4px 2px}
}
@container ll (min-width:900px){
  .ll-root .mcs-main{padding:18px 24px 92px}
  .ll-root .mcs-step-panel{max-width:820px;margin:0 auto}
}
/* launcher (floating ghost) */
.ll-launcher{position:relative;width:100%;height:100%;display:grid;place-items:center;padding:0;border:0;background:transparent;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 3px 8px rgba(0,0,0,.4));animation:ll-bob 3.4s ease-in-out infinite}
.ll-launcher img{width:44px;height:auto;max-height:64px;pointer-events:none;-webkit-user-drag:none}
.ll-launcher svg{width:40px;height:40px;pointer-events:none;color:#f4f1e4}
.ll-launcher .ll-tip{position:absolute;right:100%;top:50%;transform:translateY(-50%);margin-right:6px;padding:6px 10px;border-radius:10px;background:var(--ll-text,#222);color:var(--ll-bg,#fff);font-size:14px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}
@media (hover:hover){.ll-launcher:hover .ll-tip{opacity:1}}
.ll-launcher:focus-visible{outline:2px solid #fff;outline-offset:-2px;border-radius:14px}
@keyframes ll-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.ll-launcher{animation:none}}
/* drawer tab (settings + a fallback home when floating windows are not allowed) */
.ll-drawer{display:flex;flex-direction:column;gap:12px;padding:2px 0 16px;color:var(--ll-text);font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans KR',sans-serif}
.ll-drawer *{box-sizing:border-box}
.ll-drawer .ll-card{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--ll-line);border-radius:12px;background:var(--ll-soft)}
.ll-drawer .ll-hero{display:flex;align-items:center;gap:12px}
.ll-drawer .ll-hero img{width:56px;height:auto;flex:none}
.ll-drawer h2{margin:0;font-size:17px}
.ll-drawer p{margin:0;font-size:14px;color:var(--ll-muted)}
.ll-drawer .ll-ok{color:var(--ll-accent-text)}
.ll-drawer .ll-warn{color:var(--ll-danger)}
.ll-drawer label.ll-row{display:flex;flex-direction:column;gap:6px;font-weight:600}
.ll-drawer label.ll-check{display:flex;align-items:flex-start;gap:10px;min-height:44px;font-weight:600;cursor:pointer}
.ll-drawer label.ll-check small{display:block;font-weight:400;font-size:13px;color:var(--ll-muted)}
.ll-drawer select{width:100%;min-height:44px;padding:8px 10px;font-size:16px;border-radius:10px;border:1px solid var(--ll-line);background:var(--ll-soft-2);color:var(--ll-text)}
.ll-drawer input[type=checkbox]{width:22px;height:22px;margin-top:2px;flex:none;accent-color:var(--ll-accent)}
.ll-drawer button.ll-btn{min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--ll-accent);background:var(--ll-accent);color:var(--ll-on-accent);font-size:15px;font-weight:700;cursor:pointer}
.ll-drawer button.ll-btn.ll-quiet{background:var(--ll-soft-2);border-color:var(--ll-line);color:var(--ll-text)}
.ll-drawer ul{margin:0;padding-left:20px;font-size:14px;color:var(--ll-muted)}
.ll-drawer .ll-studio .ll-root{border-radius:12px;box-shadow:none;height:auto;overflow:visible}
.ll-drawer .ll-studio .mcs-main{overflow:visible;flex:none;touch-action:auto}
.ll-drawer .ll-studio .mcs-toast{position:sticky;left:auto;right:auto;margin:0 12px 12px}
.ll-drawer .ll-studio .mcs-shell-header{cursor:default;touch-action:auto}
`;
