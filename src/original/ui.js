// Original DOM builders (steps, fields, lorebook screens)
// Lines copied from "령령의 마리나라 제작실" v2.0.0 by you2-use (extension.js, formatted with prettier --print-width 140;
// identifiers are the original bundle's own). See NOTICE. Do not edit by hand except where a line carries an "LV:" comment.
import { Mn, Re, Ve, W, Y, Ye, Z, de, ft, ge, ke, kn, mt, nr, or, pt } from './logic.js';

function l(e, t = {}, ...n) {
  let i = document.createElement(e);
  return (Ni(i, t), Dn(i, n), i);
}
function sr(e, t = {}, ...n) {
  let i = document.createElementNS("http://www.w3.org/2000/svg", e);
  for (let [r, s] of Object.entries(t)) i.setAttribute(r, String(s));
  for (let r of n.flat(1 / 0)) r && i.append(r);
  return i;
}
function Ni(e, t) {
  for (let [n, i] of Object.entries(t))
    i == null ||
      i === !1 ||
      (n === "className"
        ? (e.className = i)
        : n === "text"
          ? (e.textContent = String(i))
          : n === "checked" || n === "disabled" || n === "hidden" || n === "open"
            ? (e[n] = !!i)
            : n === "value"
              ? (e.value = i)
              : n === "dataset" && typeof i == "object"
                ? Object.assign(e.dataset, i)
                : n === "style" && typeof i == "object"
                  ? Object.assign(e.style, i)
                  : n.startsWith("on") && typeof i == "function"
                    ? e.addEventListener(n.slice(2).toLowerCase(), i)
                    : e.setAttribute(n, i === !0 ? "" : String(i)));
}
function Dn(e, t) {
  for (let n of t.flat(1 / 0)) n == null || n === !1 || e.append(n instanceof Node ? n : document.createTextNode(String(n)));
}
function Qe(e, ...t) {
  (e.replaceChildren(), Dn(e, t));
}
function U({ label: e, hint: t, error: n, control: i }) {
  let r = i.id || `mcs-field-${Math.random().toString(36).slice(2)}`;
  i.id = r;
  let s = t ? `${r}-hint` : "",
    a = n ? `${r}-error` : "";
  return (
    (s || a) && i.setAttribute("aria-describedby", [s, a].filter(Boolean).join(" ")),
    l(
      "div",
      { className: "mcs-field" },
      l("label", { className: "mcs-label", for: r }, e),
      t ? l("p", { className: "mcs-hint", id: s }, t) : null,
      i,
      n ? l("p", { className: "mcs-error", id: a, role: "alert" }, n) : null,
    )
  );
}
function Bn(e, t, { button: n, inputControl: i, textareaControl: r }) {
  let s = e.input.external,
    a = t.external,
    o = l("p", { className: "mcs-error", role: "alert", hidden: !e.externalError }, e.externalError || ""),
    u = l("p", { className: "mcs-hint", "aria-live": "polite" });
  function m() {
    let h = s.documents.filter((g) => g.enabled && g.text.trim());
    ((u.textContent = `자료 ${s.documents.length}/5개 · 사용 ${h.length}개 · 본문 ${(Ve(s.documents) / 1e3).toFixed(1)}/110KB`),
      (o.textContent = e.externalError || ""),
      (o.hidden = !e.externalError));
  }
  let A = l(
    "div",
    { className: "mcs-external-panel mcs-form-flow" },
    U({
      label: "팬덤 위키 링크",
      control: r(s.urls, a.urls, {
        rows: 3,
        maxLength: 6e3,
        "data-mcs-external-field": "urls",
        disabled: e.externalBusy,
        placeholder: "한 줄에 링크 하나씩 · 최대 5개",
      }),
    }),
    l(
      "div",
      { className: "mcs-picker-actions mcs-external-actions" },
      n(e.externalBusy ? "불러오는 중…" : "링크 불러오기", {
        onClick: () => {
          a.fetch();
        },
        disabled: e.externalBusy,
      }),
      e.externalBusy ? n("가져오기 취소", { variant: "secondary", onClick: a.stop }) : null,
      n("직접 붙여넣기", { variant: "secondary", onClick: a.add, disabled: s.documents.length >= 5 }),
    ),
    o,
    u,
    s.documents.length
      ? l(
          "div",
          { className: "mcs-external-documents" },
          s.documents.map((h, g) => {
            let y = l("span", { className: "mcs-external-title" }, h.title.trim() || `제목 없는 자료 ${g + 1}`);
            function R(w, S, v = !1) {
              let L = v ? r : i,
                O;
              return (
                (O = L(
                  h[w],
                  (j) => {
                    (a.edit(h.id, w, j) || (O.value = h[w]), (y.textContent = h.title.trim() || `제목 없는 자료 ${g + 1}`), m());
                  },
                  {
                    "data-mcs-external-field": `${h.id}-${w}`,
                    "aria-label": `${S} ${g + 1}`,
                    disabled: !!h.loading,
                    maxLength: w === "title" ? 200 : w === "url" ? 1e3 : void 0,
                    ...(v ? { rows: 6, "data-mcs-scroll": `external-${h.id}` } : {}),
                  },
                )),
                U({ label: S, control: O })
              );
            }
            return l(
              "details",
              { className: "mcs-external-document", open: !0, "data-mcs-details": `external-${h.id}` },
              l(
                "summary",
                { className: "mcs-external-summary" },
                y,
                n("삭제", {
                  variant: "ghost",
                  ariaLabel: `외부 자료 ${g + 1} 삭제`,
                  onClick: (w) => {
                    (w.preventDefault(), w.stopPropagation(), a.remove(h.id));
                  },
                }),
              ),
              l(
                "div",
                { className: "mcs-external-fields mcs-form-flow" },
                R("title", "제목"),
                R("url", "출처"),
                h.loading ? l("p", { className: "mcs-hint", role: "status" }, "문서를 가져오는 중입니다…") : null,
                h.note ? l("p", { className: "mcs-hint" }, h.note) : null,
                R("text", "본문", !0),
                l(
                  "label",
                  { className: "mcs-external-use" },
                  l("input", {
                    type: "checkbox",
                    checked: h.enabled,
                    disabled: !!h.loading,
                    onChange: (w) => {
                      (a.edit(h.id, "enabled", w.currentTarget.checked), m());
                    },
                  }),
                  l("span", {}, "자료 사용"),
                ),
              ),
            );
          }),
        )
      : null,
  );
  return (m(), A);
}
var jn = {
  mask: [
    ["path", { d: "M3 5c3-1 6 0 9 2 3-2 6-3 9-2v7c0 5-4 7-9 9-5-2-9-4-9-9Z" }],
    ["path", { d: "M6 10c2-1 3 0 4 2m8-2c-2-1-3 0-4 2M9 16c2 1 4 1 6 0" }],
  ],
  book: [["path", { d: "M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z" }]],
  character: [
    ["circle", { cx: "12", cy: "7", r: "4" }],
    ["path", { d: "M4 21v-2a8 8 0 0 1 16 0v2" }],
  ],
  settings: [
    [
      "path",
      {
        d: "m9 3-.6 2.1-1.8 1L4.5 6 3 8.6l1.5 1.6v2.1L3 14l1.5 2.6 2.1-.1 1.8 1L9 20h3l.6-2.5 1.8-1 2.1.1L18 14l-1.5-1.7v-2.1L18 8.6 16.5 6l-2.1.1-1.8-1L12 3Z",
      },
    ],
    ["circle", { cx: "10.5", cy: "11.5", r: "3" }],
  ],
  ghost: [
    ["path", { d: "M5 20V10a7 7 0 0 1 14 0v10l-2.3-1.8L14.4 20 12 18.2 9.6 20l-2.3-1.8Z" }],
    ["circle", { cx: "9", cy: "10", r: "0.8", fill: "currentColor", stroke: "none" }],
    ["circle", { cx: "15", cy: "10", r: "0.8", fill: "currentColor", stroke: "none" }],
    ["path", { d: "M10.2 13.2c.5.7 1.1 1 1.8 1s1.3-.3 1.8-1" }],
  ],
  plusCharacter: [
    ["path", { d: "M9.5 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" }],
    ["path", { d: "M3.5 20c.7-4 2.7-6 6-6 2.2 0 3.9.9 5 2.6" }],
    ["path", { d: "M18 14v6M15 17h6" }],
  ],
  close: [["path", { d: "m6 6 12 12M18 6 6 18" }]],
  chevron: [["path", { d: "m9 18 6-6-6-6" }]],
  check: [["path", { d: "m5 12 4 4L19 6" }]],
  eye: [
    ["path", { d: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" }],
    ["circle", { cx: "12", cy: "12", r: "2.5" }],
  ],
  refresh: [
    ["path", { d: "M20 11a8 8 0 0 0-14.8-4.2L3 10" }],
    ["path", { d: "M3 4v6h6" }],
    ["path", { d: "M4 13a8 8 0 0 0 14.8 4.2L21 14" }],
    ["path", { d: "M21 20v-6h-6" }],
  ],
  up: [["path", { d: "m6 14 6-6 6 6" }]],
  down: [["path", { d: "m6 10 6 6 6-6" }]],
  reorder: [["path", { d: "m8 9 4-4 4 4M12 5v14m-4-4 4 4 4-4" }]],
  download: [
    ["path", { d: "M12 3v12" }],
    ["path", { d: "m7 10 5 5 5-5" }],
    ["path", { d: "M5 21h14" }],
  ],
  copy: [
    ["rect", { x: "8", y: "8", width: "11", height: "11", rx: "2" }],
    ["path", { d: "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" }],
  ],
  save: [
    ["path", { d: "M5 3h12l2 2v16H5Z" }],
    ["path", { d: "M8 3v6h8V3M8 21v-7h8v7" }],
  ],
  trash: [
    ["path", { d: "M4 7h16" }],
    ["path", { d: "M9 7V4h6v3" }],
    ["path", { d: "M7 7l1 14h8l1-14" }],
    ["path", { d: "M10 11v6M14 11v6" }],
  ],
  undo: [
    ["path", { d: "m9 7-5 5 5 5" }],
    ["path", { d: "M20 17a8 8 0 0 0-8-8H4" }],
  ],
  redo: [
    ["path", { d: "m15 7 5 5-5 5" }],
    ["path", { d: "M4 17a8 8 0 0 1 8-8h8" }],
  ],
  send: [
    ["path", { d: "m22 2-7 20-4-9-9-4Z" }],
    ["path", { d: "M22 2 11 13" }],
  ],
  spark: [
    ["path", { d: "m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z" }],
    ["path", { d: "m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8Z" }],
  ],
};
function Ue(e, t = 20) {
  let n = jn[e] || jn.spark;
  return sr(
    "svg",
    {
      width: t,
      height: t,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    },
    ...n.map(([i, r]) => sr(i, r)),
  );
}
var qn = [
    { key: "name", label: "이름", rows: 1, placeholder: "캐릭터 이름" },
    { key: "description", label: "설명", rows: 8 },
    { key: "personality", label: "성격", rows: 8 },
    { key: "backstory", label: "배경 이야기", rows: 8 },
    { key: "appearance", label: "외모", rows: 7 },
    { key: "scenario", label: "상황", rows: 7 },
    { key: "firstMessage", label: "첫 메시지", rows: 8 },
    { key: "exampleDialogue", label: "예시 대화", rows: 10 },
    { key: "conversationDisplayName", label: "Convo 표시 이름", rows: 2 },
    { key: "aboutMe", label: "About Me", rows: 3 },
    { key: "conversationBehavior", label: "Convo 행동 지시", rows: 6 },
  ],
  be = (e) => (e.kind === "persona" ? "페르소나" : "캐릭터"),
  Un = (e) => (e.kind === "persona" ? Ye : Re);
function dr(e, t, n = !1) {
  let i = [
    ["character", "캐릭터", "character"],
    ["persona", "페르소나", "mask"],
    ["lorebook", "로어북", "book"],
  ];
  return l(
    "header",
    { className: "mcs-shell-header" },
    l(
      "nav",
      { className: "mcs-studio-switcher", "aria-label": "제작실 선택" },
      i.map(([r, s, a]) =>
        l(
          "button",
          {
            type: "button",
            className: `mcs-studio-switcher__item${e === r ? " is-selected" : ""}`,
            "aria-label": `${s} 제작실로 전환`,
            title: `${s} 제작실`,
            "aria-pressed": String(e === r),
            disabled: n,
            onClick: () => t.switchStudio(r),
          },
          Ue(a, 16),
        ),
      ),
    ),
    l("h1", {}, `${i.find(([r]) => r === e)[1]} 제작실`),
    l(
      "div",
      { className: "mcs-shell-header__actions" },
      C("", {
        variant: "ghost",
        icon: "refresh",
        ariaLabel: "데이터 초기화",
        title: "데이터 초기화",
        onClick: t.clearTemporary,
        disabled: n,
      }),
      C("", {
        variant: "ghost",
        icon: "save",
        ariaLabel: e === "lorebook" ? "로어북 임시 저장" : "임시 저장",
        title: "임시 저장",
        onClick: t.saveTemporary,
        disabled: n,
      }),
      C("", { variant: "ghost", icon: "close", ariaLabel: "제작실 닫기", title: "닫기", onClick: t.close }),
    ),
  );
}
function C(
  e,
  {
    variant: t = "primary",
    icon: n = "",
    onClick: i,
    disabled: r = !1,
    wide: s = !1,
    ariaLabel: a = "",
    title: o = "",
    className: u = "",
  } = {},
) {
  return l(
    "button",
    {
      type: "button",
      className: `mcs-button mcs-button--${t}${e ? "" : " mcs-button--icon-only"}${s ? " mcs-button--wide" : ""}${u ? ` ${u}` : ""}`,
      onClick: i,
      disabled: r,
      "aria-label": a || void 0,
      title: o || void 0,
    },
    n ? Ue(n, 15) : null,
    e ? l("span", {}, e) : null,
  );
}
function He(e, t, n = {}) {
  return l("input", { type: "text", className: "mcs-input", value: e ?? "", onInput: (i) => t?.(i.currentTarget.value), ...n });
}
function V(e, t, n = {}) {
  return l("textarea", { className: "mcs-textarea", value: e ?? "", onInput: (i) => t?.(i.currentTarget.value), ...n });
}
function ue(e, t, n, i = {}) {
  let r = l(
    "select",
    { className: "mcs-select", onChange: (s) => n?.(s.currentTarget.value), ...i },
    t.map((s) => l("option", { value: s.value, disabled: s.disabled }, s.label)),
  );
  return ((r.value = e ?? ""), r);
}
function Te(e, t) {
  return l("div", { className: "mcs-section-heading" }, l("h2", {}, e), t ? l("p", {}, t) : null);
}
function ve(e, t, n, i) {
  return l(
    "div",
    { className: "mcs-segmented", role: "radiogroup", "aria-label": i },
    e.map((r) =>
      l(
        "button",
        {
          type: "button",
          role: "radio",
          className: `mcs-segmented__item${t === r.value ? " is-selected" : ""}`,
          "aria-checked": String(t === r.value),
          "aria-label": r.accessibleLabel || void 0,
          onClick: () => n(r.value),
        },
        l("span", {}, r.label),
        r.hint ? l("small", {}, r.hint) : null,
      ),
    ),
  );
}
function Ee(e, t, n, i = !1) {
  return C("", { variant: "ghost", icon: t, ariaLabel: e, title: e, className: "mcs-inline-action", onClick: n, disabled: i });
}
function tt(e, ...t) {
  return l("div", { className: "mcs-action-heading" }, l("h3", {}, e), l("div", { className: "mcs-action-heading__buttons" }, t));
}
function rt({ title: e, description: t, checked: n, onChange: i, helpId: r }) {
  return l(
    "div",
    { className: "mcs-context-control" },
    l(
      "label",
      { className: "mcs-toggle-row" },
      l("input", { type: "checkbox", checked: n, onChange: (s) => i(s.currentTarget.checked) }),
      l("strong", {}, e),
    ),
    l(
      "details",
      { className: "mcs-context-help", "data-mcs-details": r },
      l("summary", { "aria-label": `${e} 설명`, title: `${e} 설명` }, "?"),
      l("p", { className: "mcs-context-help__body" }, t),
    ),
  );
}
function ur(e, t, n) {
  return l(
    "div",
    { className: "mcs-help-label" },
    l("span", { className: "mcs-label" }, e),
    l(
      "details",
      { className: "mcs-context-help", "data-mcs-details": n },
      l("summary", { "aria-label": `${e} 설명`, title: `${e} 설명` }, "?"),
      l(
        "div",
        { className: "mcs-context-help__body mcs-length-help" },
        Object.values(t).map((i) => l("p", {}, `${i.label}: ${i.target}`)),
      ),
    ),
  );
}
function Ci(e, t) {
  return e.loadingHost
    ? l("p", { className: "mcs-hint" }, "마리나라의 캐릭터·페르소나·로어북 목록을 불러오는 중입니다…")
    : e.hostError
      ? l(
          "div",
          { className: "mcs-final-section" },
          l("p", { className: "mcs-error" }, e.hostError),
          C("다시 불러오기", { variant: "secondary", icon: "refresh", onClick: t.refreshHost }),
        )
      : null;
}
function pr(e, t) {
  let n = e.input.personaIds.map((a) => e.personas.find((o) => o.id === a)).filter(Boolean),
    i = e.personas.filter(
      (a) => !e.input.personaIds.includes(a.id) && !(e.kind === "persona" && e.input.mode === "edit" && e.input.editCharacterId === a.id),
    ),
    r = e.input.personaIds.length >= 3,
    s = [
      { value: "", label: r ? "최대 3개를 선택했습니다" : i.length ? "참고 페르소나 추가…" : "추가할 페르소나가 없습니다" },
      ...i.map((a) => ({ value: a.id, label: a.name, disabled: r })),
    ];
  return l(
    "fieldset",
    { className: "mcs-picker-fieldset mcs-world-persona-block" },
    l("legend", {}, "참고 페르소나 (최대 3개)"),
    e.personas.length
      ? ue("", s, (a) => a && t.addPersona(a), { disabled: r })
      : l("p", { className: "mcs-hint" }, "불러온 기존 페르소나가 없습니다."),
    n.length
      ? l(
          "div",
          { className: "mcs-selected-reference-list" },
          n.map((a) =>
            l(
              "span",
              { className: "mcs-selected-reference" },
              l("span", { className: "mcs-selected-reference__name" }, a.name),
              C("", {
                variant: "ghost",
                icon: "close",
                ariaLabel: `${a.name} 페르소나 선택 취소`,
                title: "선택 취소",
                className: "mcs-selected-reference__remove",
                onClick: () => t.removePersona(a.id),
              }),
            ),
          ),
        )
      : null,
  );
}
function lr(e, t) {
  if (!["world", "edit"].includes(e.input.mode)) return null;
  let n = e.input.lorebookEntryIds.length,
    i = new Set(e.input.lorebookEntryIds),
    r = e.lorebookEntries.filter((y) => y.enabled !== !1),
    s = e.input.characterIds.map((y) => e.characters.find((R) => R.id === y)).filter(Boolean),
    a = e.characters.filter((y) => !e.input.characterIds.includes(y.id)),
    o = e.input.characterIds.length >= 3,
    u = [
      { value: "", label: o ? "최대 3명을 선택했습니다" : a.length ? "참고 캐릭터 추가…" : "추가할 캐릭터가 없습니다", disabled: !1 },
      ...a.map((y) => ({ value: y.id, label: y.name, disabled: o })),
    ],
    m = [{ value: "", label: "로어북 선택 안 함" }, ...e.lorebooks.map((y) => ({ value: y.id, label: y.name }))],
    A =
      e.input.mode === "edit"
        ? l(
            "div",
            { className: "mcs-world-character-block" },
            U({
              label: e.kind === "persona" ? "수정 페르소나 선택" : "수정 캐릭터 선택",
              control: ue(
                e.input.editCharacterId,
                [
                  { value: "", label: `수정할 ${be(e)} 선택…` },
                  ...(e.kind === "persona" ? e.personas : e.characters).map((y) => ({ value: y.id, label: y.name })),
                ],
                (y) => t.updateInput("editCharacterId", y, !0),
                { disabled: !!e.request },
              ),
            }),
          )
        : null,
    h =
      e.input.mode === "edit" && e.kind !== "persona"
        ? null
        : l(
            "fieldset",
            { className: "mcs-picker-fieldset mcs-world-character-block" },
            l("legend", {}, "참고 캐릭터 (최대 3명)"),
            e.characters.length
              ? ue("", u, (y) => y && t.addCharacter(y), { disabled: o })
              : l("p", { className: "mcs-hint" }, "불러온 기존 캐릭터가 없습니다."),
            s.length
              ? l(
                  "div",
                  { className: "mcs-selected-reference-list" },
                  s.map((y) =>
                    l(
                      "span",
                      { className: "mcs-selected-reference" },
                      l("span", { className: "mcs-selected-reference__name" }, y.name),
                      C("", {
                        variant: "ghost",
                        icon: "close",
                        ariaLabel: `${y.name} 선택 취소`,
                        title: "선택 취소",
                        className: "mcs-selected-reference__remove",
                        onClick: () => t.removeCharacter(y.id),
                      }),
                    ),
                  ),
                )
              : null,
          ),
    g = l(
      "div",
      { className: "mcs-world-lorebook-block" },
      U({ label: "참고 로어북", control: ue(e.input.lorebookId, m, t.setLorebook) }),
      e.input.lorebookId
        ? l(
            "fieldset",
            { className: "mcs-picker-fieldset mcs-lorebook-entry-fieldset" },
            l("legend", {}, "로어북 항목"),
            e.lorebookEntriesLoading
              ? l("p", { className: "mcs-hint" }, "로어북 항목을 불러오는 중입니다…")
              : e.lorebookEntriesError
                ? l("p", { className: "mcs-error" }, e.lorebookEntriesError)
                : r.length
                  ? l(
                      "details",
                      { className: "mcs-world-character-picker mcs-lorebook-entry-picker", "data-mcs-details": "lorebook-entries" },
                      l(
                        "summary",
                        {},
                        l("span", {}, "로어북 항목 목록 보기"),
                        l("span", { className: "mcs-summary-count" }, `${n}/${r.length} 선택`),
                      ),
                      l(
                        "div",
                        { className: "mcs-picker-actions" },
                        C("연결 해제", { variant: "ghost", icon: "close", onClick: t.disconnectLorebook }),
                        C("전체 선택", { variant: "ghost", onClick: () => t.setAllLorebookEntries(!0) }),
                        C("전체 해제", { variant: "ghost", onClick: () => t.setAllLorebookEntries(!1) }),
                      ),
                      l(
                        "div",
                        { className: "mcs-choice-list", "data-mcs-scroll": "lorebook-entry-list" },
                        e.lorebookEntries.map((y) => {
                          let R = y.enabled === !1,
                            w = !R && i.has(y.id),
                            S = y.name || y.keys.join(", ") || "이름 없는 항목";
                          return l(
                            "label",
                            { className: `mcs-choice-row${w ? " is-selected" : ""}${R ? " is-disabled" : ""}` },
                            l("input", { type: "checkbox", checked: w, disabled: R, onChange: () => t.toggleLorebookEntry(y.id) }),
                            l("span", {}, R ? `${S} (비활성)` : S),
                          );
                        }),
                      ),
                    )
                  : l("p", { className: "mcs-hint" }, "이 로어북에는 참조할 항목이 없습니다."),
          )
        : null,
    );
  return e.kind === "persona" && e.input.mode === "edit"
    ? (A.classList.add("mcs-persona-edit-source"), l("div", { className: "mcs-persona-edit-selectors" }, A, h, g))
    : l(
        "div",
        { className: `mcs-world-selectors mcs-world-selectors--${e.input.mode === "edit" ? "character-edit" : "reference"}` },
        e.input.mode === "edit" ? A : h,
        pr(e, t),
        g,
      );
}
function Ii(e, t) {
  return l(
    "div",
    { className: "mcs-keyword-groups" },
    Object.entries(kn).map(([n, i], r) => {
      let s = i.filter((a) => e.input.keywords.includes(a));
      return l(
        "details",
        { className: "mcs-keyword-group", open: r === 0, "data-mcs-details": `keyword-${n}` },
        l(
          "summary",
          {},
          l(
            "span",
            { className: "mcs-keyword-summary-main" },
            l("span", { className: "mcs-keyword-summary-label" }, n),
            s.length
              ? l(
                  "span",
                  { className: "mcs-keyword-summary-selected", "aria-label": `${n} 선택 키워드` },
                  s.map((a) => l("span", { className: "mcs-summary-keyword" }, `[${a}]`)),
                )
              : null,
          ),
          l("span", { className: `mcs-summary-count${s.length ? " mcs-summary-count--has-selected" : ""}` }, `${s.length}개`),
        ),
        l(
          "div",
          { className: "mcs-chip-list" },
          i.map((a) => {
            let o = e.input.keywords.includes(a);
            return l(
              "button",
              {
                type: "button",
                className: `mcs-chip${o ? " is-selected" : ""}`,
                "aria-pressed": String(o),
                onClick: () => t.toggleKeyword(a),
              },
              a,
            );
          }),
        ),
      );
    }),
  );
}
function fr(e, t) {
  return e.input.mode !== "world"
    ? lr(e, t)
    : l(
        "div",
        { className: "mcs-form-flow" },
        ve(
          [
            { value: "internal", label: "내부 자료" },
            { value: "external", label: "외부 자료" },
          ],
          e.input.referenceKind || "internal",
          t.external.choose,
          "참고 자료 종류",
        ),
        e.input.referenceKind === "external" ? Bn(e, t, { button: C, inputControl: He, textareaControl: V }) : lr(e, t),
      );
}
function Oi(e, t) {
  return l(
    "section",
    { className: "mcs-step-panel", role: "tabpanel", id: "mcs-step-prepare", tabindex: "-1" },
    Te(`${be(e)} 제작 준비`),
    Ci(e, t),
    l(
      "div",
      { className: "mcs-form-flow" },
      l(
        "div",
        { className: "mcs-field" },
        l("span", { className: "mcs-label" }, "제작 방식"),
        ve(
          [
            { value: "free", label: "자유", accessibleLabel: "자유 제작" },
            { value: "world", label: "참고", accessibleLabel: "기존 자료 참고" },
            { value: "edit", label: "편집", accessibleLabel: `기존 ${be(e)} 편집` },
          ],
          e.input.mode,
          (n) => t.updateInput("mode", n, !0),
          "제작 방식",
        ),
      ),
      e.input.mode === "edit"
        ? l(
            "div",
            { className: "mcs-existing-edit-fields" },
            lr(e, t),
            U({
              label: "요청 사항",
              control: V(e.input.editRequest, (n) => t.updateInput("editRequest", n), {
                placeholder: "편집하면서 반영하고 싶은 요청이 있다면 적어 주세요.",
                rows: 1,
                className: "mcs-textarea mcs-textarea--single",
                maxLength: 12e3,
              }),
            }),
          )
        : fr(e, t),
      ...(e.input.mode === "edit"
        ? []
        : [
            l(
              "div",
              { className: "mcs-two-column mcs-demographics" },
              l(
                "div",
                { className: "mcs-field mcs-gender-field" },
                l("span", { className: "mcs-label" }, "성별"),
                ve(
                  [
                    { value: "남", label: "남" },
                    { value: "여", label: "여" },
                  ],
                  e.input.gender,
                  (n) => t.updateInput("gender", e.input.gender === n ? "" : n, !0),
                  "성별",
                ),
              ),
              U({
                label: "나이",
                control: He(e.input.age, (n) => t.updateInput("age", n), { placeholder: "예: 27세, 300살, 20대 후반", maxLength: 80 }),
              }),
            ),
            l("div", { className: "mcs-field" }, l("span", { className: "mcs-label" }, "키워드"), Ii(e, t)),
            U({
              label: e.kind === "persona" ? "페르소나 구상" : "캐릭터 구상",
              control: V(e.input.idea, (n) => t.updateInput("idea", n), {
                placeholder: "예: 야간 도서관에서 일하는 무뚝뚝한 사서…",
                rows: 2,
                className: "mcs-textarea mcs-textarea--double",
                maxLength: 12e3,
              }),
            }),
            U({
              label: "추가 요청",
              control: V(e.input.wants, (n) => t.updateInput("wants", n), {
                rows: 1,
                className: "mcs-textarea mcs-textarea--single",
                maxLength: 8e3,
              }),
            }),
          ]),
      e.input.mode === "edit"
        ? l(
            "div",
            { className: "mcs-final-section mcs-no-bottom-divider mcs-prepare-final-section" },
            C("편집 바로 이동", {
              icon: "send",
              wide: !0,
              onClick: t.startExistingEdit,
              disabled: !!e.request || e.loadingHost || e.lorebookEntriesLoading || !e.input.editCharacterId,
            }),
          )
        : l(
            "div",
            { className: "mcs-final-section mcs-no-bottom-divider mcs-prepare-final-section" },
            tt(
              "RP방으로 넘기기",
              Ee("제작 브리핑을 RP 입력창에 넣기", "send", t.prepareBriefingToChat, !!e.request),
              Ee("브리핑 복사", "copy", t.copyBriefing),
            ),
            C("령령에게 바로 요청", { icon: "spark", wide: !0, onClick: t.prepareBriefingAndSend, disabled: !!e.request }),
            C("브리핑 미리 보기", { variant: "secondary", icon: "eye", onClick: t.prepareBriefing, disabled: !!e.request, wide: !0 }),
            e.bridge.briefing
              ? V(e.bridge.briefing, null, {
                  rows: 6,
                  readOnly: !0,
                  className: "mcs-textarea mcs-briefing-preview",
                  "aria-label": "제작 브리핑 미리 보기",
                })
              : null,
          ),
    ),
  );
}
function Hn(e, { compact: t = !1 } = {}) {
  return e.bridge.hasImport
    ? t
      ? l(
          "p",
          { className: `mcs-import-status ${e.bridge.missing.length ? "mcs-error" : "mcs-hint"}`, role: "status" },
          e.bridge.missing.length ? `확인이 필요한 항목: ${e.bridge.missing.join(" · ")}` : "필수 항목을 모두 찾았습니다.",
        )
      : l(
          "div",
          { className: "mcs-final-section mcs-import-status" },
          l("h3", {}, "가져온 결과"),
          l(
            "p",
            { className: "mcs-hint" },
            e.editingSource && !e.bridge.importedRaw
              ? `원본 ‘${e.editingSource.name}’의 편집 항목을 불러왔습니다.`
              : e.bridge.wrapped
                ? "제작실 내보내기 패킷을 인식했습니다."
                : "필드 항목을 직접 인식해 가져왔습니다.",
          ),
          e.bridge.found.length
            ? l("div", {}, l("p", { className: "mcs-label" }, "찾은 항목"), l("p", { className: "mcs-hint" }, e.bridge.found.join(" · ")))
            : null,
          e.bridge.missing.length
            ? l(
                "div",
                {},
                l("p", { className: "mcs-label" }, "확인이 필요한 항목"),
                l("p", { className: "mcs-error" }, e.bridge.missing.join(" · ")),
              )
            : l("p", { className: "mcs-hint" }, "필수 항목을 모두 찾았습니다."),
        )
    : null;
}
function Ti(e, t) {
  return l(
    "div",
    { className: "mcs-final-section mcs-reference-toggle-section" },
    rt({
      title: "참고 자료 상시 주입",
      description: "선택한 제작 정보와 내부·외부 참고 자료를 이 RP방의 새 답변에 계속 전달합니다.",
      checked: e.referenceContext.enabled,
      onChange: t.setReferenceContext,
      helpId: "character-reference-help",
    }),
    e.referenceContext.enabled && e.referenceContext.chatId !== e.bridge.chatId
      ? l("p", { className: "mcs-hint" }, "다른 RP방에 연결되어 있습니다. 이 방에 연결하려면 토글을 껐다 켜세요.")
      : null,
  );
}
function _i(e, t) {
  return l(
    "section",
    { className: "mcs-step-panel", role: "tabpanel", id: "mcs-step-rp", tabindex: "-1" },
    Te("RP방에서 령령과 제작", "령령과 평소처럼 대화하세요."),
    l(
      "div",
      { className: "mcs-form-flow" },
      l(
        "div",
        { className: "mcs-final-section" },
        tt(
          "최종본 요청",
          Ee("최종본 요청문을 RP 입력창에 넣기", "send", t.exportRequestToChat),
          Ee("최종본 요청문 복사", "copy", t.copyExportRequest),
        ),
        l(
          "div",
          { className: "mcs-field" },
          l("span", { className: "mcs-label" }, "프롬프트 형식"),
          ve(
            [
              { value: "markdown", label: "마크다운" },
              { value: "prose", label: "서술형" },
            ],
            e.outputFormat,
            t.setOutputFormat,
            "프롬프트 형식",
          ),
        ),
        l(
          "div",
          { className: "mcs-field" },
          ur("프롬프트 분량", Un(e), `${e.kind}-length-help`),
          ve(
            Object.entries(Un(e)).map(([n, i]) => ({ value: n, label: i.label })),
            e.lengthMode,
            t.setLengthMode,
            "프롬프트 분량",
          ),
        ),
        C("최종본 바로 요청", { icon: "spark", onClick: t.exportRequestAndSend, wide: !0 }),
      ),
      l(
        "div",
        { className: "mcs-final-section mcs-rp-import-section" },
        l("h3", {}, "답변 가져오기"),
        l("p", { className: "mcs-hint" }, "령령이 답변을 출력한 후 사용하세요"),
        C("마지막 AI 답변 가져오기", { icon: "download", wide: !0, onClick: t.importLatestAssistant, disabled: !!e.request }),
        l(
          "details",
          { className: "mcs-advanced", "data-mcs-details": "manual-import" },
          l("summary", {}, "답변을 직접 붙여넣기"),
          l(
            "div",
            { className: "mcs-advanced__body" },
            V(e.bridge.manualText, t.updateManualText, { rows: 6, placeholder: "령령의 최종본·수정 답변을 붙여넣으세요." }),
            C("붙여넣은 답변 분석", { variant: "secondary", onClick: t.importManualText }),
          ),
        ),
        e.bridge.error ? l("p", { className: "mcs-error" }, e.bridge.error) : null,
      ),
      Hn(e),
    ),
  );
}
function et(e) {
  return Array.isArray(e) ? e.some((t) => String(t || "").trim()) : !!String(e || "").trim();
}
function Mi(e, t) {
  let i = (
    e.kind === "persona"
      ? qn
          .slice(0, 6)
          .map((a) => ({
            ...a,
            label: a.key === "scenario" ? "시나리오" : a.label,
            placeholder: a.key === "name" ? "페르소나 이름" : a.placeholder,
          }))
      : qn
  ).map((a) => {
    let o = e.openEditorSection.includes(a.key),
      u = e.draft[a.key],
      m = et(u),
      A = de(e.draft, a.key, e.tokenProfile),
      h = o
        ? a.rows === 1
          ? He(u, (g) => t.updateDraftField(a.key, g), { placeholder: a.placeholder || "" })
          : V(u, (g) => t.updateDraftField(a.key, g), { rows: a.rows, placeholder: a.placeholder || "" })
        : null;
    return l(
      "section",
      { className: `mcs-editor-section${o ? " is-open" : ""}` },
      l(
        "button",
        {
          type: "button",
          className: "mcs-editor-section__toggle",
          onClick: () => t.toggleEditorSection(a.key),
          "aria-expanded": String(o),
        },
        l("span", { className: "mcs-editor-section__chevron" }, Ue("chevron", 17)),
        l("span", { className: "mcs-editor-section__label" }, a.label),
        l(
          "span",
          { className: `mcs-editor-section__status${m ? " is-complete" : ""}`, "data-token-field": a.key },
          m ? `입력됨 · 약 ${A.toLocaleString()}토큰` : "비어 있음 · 0토큰",
        ),
      ),
      o ? l("div", { className: "mcs-editor-section__body" }, U({ label: a.label, control: h })) : null,
    );
  });
  if (e.kind === "persona") return l("div", { className: "mcs-editor-sections" }, i);
  let r = e.openEditorSection.includes("alternateGreetings"),
    s = de(e.draft, "alternateGreetings", e.tokenProfile);
  return (
    i.push(
      l(
        "section",
        { className: `mcs-editor-section${r ? " is-open" : ""}` },
        l(
          "button",
          {
            type: "button",
            className: "mcs-editor-section__toggle",
            onClick: () => t.toggleEditorSection("alternateGreetings"),
            "aria-expanded": String(r),
          },
          l("span", { className: "mcs-editor-section__chevron" }, Ue("chevron", 17)),
          l("span", { className: "mcs-editor-section__label" }, "대체 인사"),
          l(
            "span",
            {
              className: `mcs-editor-section__status${e.draft.alternateGreetings.length ? " is-complete" : ""}`,
              "data-token-field": "alternateGreetings",
            },
            `${e.draft.alternateGreetings.length}개 · 약 ${s.toLocaleString()}토큰`,
          ),
        ),
        r
          ? l(
              "div",
              { className: "mcs-editor-section__body" },
              ...e.draft.alternateGreetings.map((a, o) =>
                l(
                  "div",
                  { className: "mcs-field" },
                  V(a, (u) => t.updateAlternateGreeting(o, u), { rows: 5 }),
                  l(
                    "span",
                    { className: "mcs-editor-token-count", "data-token-greeting": o },
                    `약 ${de(e.draft.alternateGreetings, o, e.tokenProfile).toLocaleString()}토큰`,
                  ),
                  C("이 인사 삭제", { variant: "ghost", onClick: () => t.removeAlternateGreeting(o) }),
                ),
              ),
              C("대체 인사 추가", { variant: "secondary", onClick: t.addAlternateGreeting }),
            )
          : null,
      ),
    ),
    l("div", { className: "mcs-editor-sections" }, i)
  );
}
function Li(e, t) {
  return l(
    "section",
    { className: "mcs-step-panel", role: "tabpanel", id: "mcs-step-edit", tabindex: "-1" },
    Hn(e, { compact: !0 }),
    l(
      "div",
      { className: "mcs-heading-row" },
      l(
        "div",
        { className: "mcs-section-heading" },
        l(
          "div",
          { className: "mcs-edit-title-row" },
          l("h2", {}, `가져온 ${be(e)} 편집`),
          l(
            "div",
            { className: "mcs-heading-actions" },
            C("이전", { variant: "secondary", icon: "undo", onClick: t.undoDraft, disabled: !e.undo.length }),
            C("복원", { variant: "secondary", icon: "redo", onClick: t.restoreDraft, disabled: !e.redo.length }),
          ),
        ),
        l(
          "p",
          {},
          e.editingSource
            ? `기존 ${be(e)}의 항목을 확인하고 필요한 부분만 수정하세요.`
            : "령령 답변에서 읽은 항목을 확인하고 필요한 부분만 수정하세요.",
        ),
        l(
          "div",
          { className: "mcs-token-toolbar" },
          l("span", { className: "mcs-character-summary__token-total", "data-token-total": "" }, Vn(e)),
          C("", {
            variant: "ghost",
            icon: "settings",
            className: "mcs-token-settings-button",
            ariaLabel: "토큰 추정 설정",
            title: "토큰 추정 설정",
            onClick: t.toggleTokenSettings,
          }),
        ),
        e.tokenSettingsOpen
          ? l(
              "div",
              { className: "mcs-token-settings" },
              U({
                label: "추정 토큰 기준",
                control: ue(
                  e.tokenProfile,
                  Object.entries(Z).map(([n, i]) => ({ value: n, label: i.label })),
                  t.setTokenProfile,
                ),
              }),
              l("p", { className: "mcs-hint" }, "가벼운 로컬 추정치로, 실제 토크나이저/API와 차이가 날 수 있습니다."),
            )
          : null,
      ),
    ),
    Ti(e, t),
    rt({
      title: "현재 프롬프트 상시 주입",
      description: "최신 편집본을 이 RP방의 새 답변에 계속 전달합니다.",
      checked: e.revision.injectCurrentPrompt,
      onChange: t.setInjectCurrentPrompt,
      helpId: "character-current-prompt-help",
    }),
    e.revision.injectCurrentPrompt && e.contextChatId !== e.bridge.chatId
      ? l(
          "p",
          { className: "mcs-hint mcs-current-prompt-warning" },
          "상시 주입: 다른 RP방에 연결되어 있습니다. 이 방에 연결하려면 토글을 껐다 켜세요.",
        )
      : null,
    Mi(e, t),
    l(
      "details",
      { className: "mcs-advanced mcs-revision-details", "data-mcs-details": "revision-request" },
      l(
        "summary",
        {},
        l("span", {}, "부분 수정 요청"),
        l(
          "span",
          { className: "mcs-revision-quick-actions" },
          Ee(
            "수정 요청을 입력창에 넣기",
            "send",
            (n) => {
              (n.preventDefault(), n.stopPropagation(), t.revisionRequestToChat());
            },
            !!e.request,
          ),
          Ee(
            "수정 요청문 복사",
            "copy",
            (n) => {
              (n.preventDefault(), n.stopPropagation(), t.copyRevisionRequest());
            },
            !!e.request,
          ),
        ),
      ),
      l(
        "div",
        { className: "mcs-advanced__body" },
        V(e.revision.instruction, t.updateRevisionInstruction, {
          "aria-label": "수정 요청 내용",
          rows: 3,
          maxLength: 8e3,
          placeholder:
            e.kind === "persona"
              ? "예: 성격은 더 차분하게 바꾸고 외모는 유지해줘."
              : "예: 설명과 성격만 영어로 번역해줘. 첫 메시지는 한국어로 유지해줘.",
        }),
        l(
          "div",
          { className: "mcs-revision-actions" },
          C("수정 요청 바로 보내기", { icon: "spark", onClick: t.revisionRequestAndSend, disabled: !!e.request }),
        ),
      ),
    ),
    l("div", { className: "mcs-edit-import-divider", "aria-hidden": "true" }),
    l(
      "div",
      { className: "mcs-final-section mcs-edit-import-section" },
      l("h3", {}, "답변 가져오기"),
      l("p", { className: "mcs-hint" }, "령령이 답변을 출력한 후 사용하세요"),
      C("마지막 답변 가져오기", { icon: "download", wide: !0, onClick: t.applyLatestRevision, disabled: !!e.request }),
      l(
        "details",
        { className: "mcs-advanced", "data-mcs-details": "edit-manual-import" },
        l("summary", {}, "답변을 직접 붙여넣기"),
        l(
          "div",
          { className: "mcs-advanced__body" },
          V(e.bridge.manualText, t.updateManualText, { rows: 6, placeholder: "령령의 최종본·수정 답변을 붙여넣으세요." }),
          C("붙여넣은 답변 분석", { variant: "secondary", onClick: t.importManualText }),
        ),
      ),
      e.bridge.error ? l("p", { className: "mcs-error" }, e.bridge.error) : null,
    ),
  );
}
function Pi(e, t) {
  let n =
    e.kind === "persona"
      ? W.map(([, i, r]) => [r, e.draft[i]])
      : [
          ["이름", e.draft.name],
          ["설명", e.draft.description],
          ["성격", e.draft.personality],
          ["배경", e.draft.backstory],
          ["외모", e.draft.appearance],
          ["상황", e.draft.scenario],
          ["첫 메시지", e.draft.firstMessage],
          ["예시 대화", e.draft.exampleDialogue],
        ];
  return l(
    "section",
    { className: "mcs-step-panel", role: "tabpanel", id: "mcs-step-final", tabindex: "-1" },
    Te(
      "최종 확인 및 저장",
      e.editingSource
        ? `새 ${be(e)}로 등록하거나 원본 ‘${e.editingSource.name}’에 변경 사항을 저장합니다.`
        : `기존 ${be(e)}를 덮어쓰지 않고 새 ${be(e)}로 등록합니다.`,
    ),
    l(
      "div",
      { className: "mcs-final-section" },
      l("h3", {}, e.draft.name || "이름 미정"),
      l(
        "ul",
        { className: "mcs-check-list" },
        n.map(([i, r]) =>
          l(
            "li",
            { className: et(r) ? "is-passed" : "" },
            l("span", {}, i),
            l("span", { className: "mcs-check-status", "aria-label": et(r) ? "확인됨" : "비어 있음" }, et(r) ? "O" : "X"),
          ),
        ),
      ),
    ),
    l(
      "div",
      { className: "mcs-completion-actions" },
      l(
        "div",
        { className: "mcs-final-section" },
        l("h3", {}, "마리나라에 바로 저장"),
        C(e.registeredCharacterId ? "등록 완료" : e.kind === "persona" ? "새 페르소나로 등록" : "새 캐릭터로 등록", {
          icon: "plusCharacter",
          onClick: t.registerCharacter,
          disabled: !!e.request || !!e.registeredCharacterId,
        }),
        e.editingSource
          ? C(e.kind === "persona" ? "원본 페르소나에 저장" : "원본 캐릭터에 저장", {
              icon: "save",
              onClick: t.saveOriginalCharacter,
              disabled: !!e.request,
            })
          : null,
      ),
      l(
        "div",
        { className: "mcs-final-section mcs-no-bottom-divider" },
        l("h3", {}, "파일로 저장"),
        C(e.kind === "persona" ? "페르소나 JSON 저장" : "캐릭터 JSON 저장", {
          variant: "secondary",
          icon: "download",
          onClick: t.downloadCharacter,
        }),
        C("JSON 전체 복사", { variant: "secondary", icon: "copy", onClick: t.copyCharacter }),
      ),
    ),
  );
}
function cr(e) {
  return e >= 0 && e < ke.length;
}
function mr(e, t) {
  let n = e.step - 1,
    i = e.step + 1;
  return l(
    "nav",
    { className: "mcs-stepper", "aria-label": `${be(e)} 제작 단계`, role: "tablist" },
    C("", {
      variant: "ghost",
      className: "mcs-step-nav mcs-step-nav--previous",
      icon: "chevron",
      ariaLabel: n >= 0 ? `${ke[n]} 단계로 이동` : "이전 단계 없음",
      title: n >= 0 ? `${ke[n]} 단계로 이동` : "이전 단계 없음",
      onClick: () => t.goStep(n),
      disabled: n < 0 || !cr(n),
    }),
    ke.map((r, s) =>
      l(
        "button",
        {
          type: "button",
          className: `mcs-step${e.step === s ? " is-current" : ""}${s < e.step ? " is-complete" : ""}`,
          disabled: !cr(s),
          onClick: () => t.goStep(s),
          "aria-current": e.step === s ? "step" : void 0,
        },
        l("span", { className: "mcs-step__number" }, String(s + 1)),
        l("span", { className: "mcs-step__label" }, r),
        l("span", { className: "mcs-step__mobile" }, `${s + 1}/${ke.length} ${r}`),
      ),
    ),
    C("", {
      variant: "ghost",
      className: "mcs-step-nav mcs-step-nav--next",
      icon: "chevron",
      ariaLabel: i <= 3 ? `${ke[i]} 단계로 이동` : "다음 단계 없음",
      title: i <= 3 ? `${ke[i]} 단계로 이동` : "다음 단계 없음",
      onClick: () => t.goStep(i),
      disabled: i > 3 || !cr(i),
    }),
  );
}
function Fn(e, t) {
  return e.notice
    ? l(
        "div",
        {
          className: `mcs-toast${e.notice.kind === "error" ? " mcs-toast--error" : ""}`,
          role: e.notice.kind === "error" ? "alert" : "status",
        },
        l("span", {}, e.notice.message),
        C("", { variant: "ghost", icon: "close", ariaLabel: "알림 닫기", onClick: t.dismissNotice }),
      )
    : null;
}
function hr(e, t, n) {
  e.querySelector(".mcs-toast")?.remove();
  let i = e.querySelector(".mcs-overlay"),
    r = t.open ? Fn(t, n) : null;
  i && r && i.append(r);
}
function $i(e, t) {
  let n = [Oi, _i, Li, Pi][e.step](e, t);
  return l(
    "div",
    { className: "mcs-overlay" },
    l(
      "div",
      { className: "mcs-shell" },
      dr(e.kind || "character", t, !!e.request || e.loadingHost || e.lorebookEntriesLoading),
      mr(e, t),
      l("main", { className: "mcs-main" }, n),
      l("div", { className: "mcs-resizer", role: "separator", "aria-label": "제작실 창 크기 조절" }),
    ),
    Fn(e, t),
  );
}
function Di(e) {
  return l(
    "button",
    { type: "button", className: "mcs-launcher", onClick: e.open, title: "령령의 제작실", "aria-label": "령령의 제작실" },
    Ue("ghost", 20),
  );
}
function Gn(e, t, n) {
  if (t.open) {
    Qe(e, $i(t, n));
    return;
  }
  Qe(e, Di(n));
}
function Vn(e) {
  let t = Z[e.tokenProfile] || Z.gemini;
  return `전체 약 ${Mn(e.draft, e.tokenProfile).toLocaleString()}토큰 · ${t.label} 추정`;
}
function gr(e, t) {
  let n = e.querySelector("[data-token-total]"),
    i = Vn(t);
  n && n.textContent !== i && (n.textContent = i);
  for (let r of e.querySelectorAll("[data-token-field]")) {
    let s = r.getAttribute("data-token-field"),
      a = t.draft[s],
      o = et(a),
      u = de(t.draft, s, t.tokenProfile).toLocaleString();
    r.classList.contains("is-complete") !== o && r.classList.toggle("is-complete", o);
    let m = s === "alternateGreetings" ? `${a.length}개 · 약 ${u}토큰` : o ? `입력됨 · 약 ${u}토큰` : "비어 있음 · 0토큰";
    r.textContent !== m && (r.textContent = m);
  }
  for (let r of e.querySelectorAll("[data-token-greeting]")) {
    let s = `약 ${de(t.draft.alternateGreetings, Number(r.getAttribute("data-token-greeting")), t.tokenProfile).toLocaleString()}토큰`;
    r.textContent !== s && (r.textContent = s);
  }
}
var yr = (e, ...t) => l("div", { className: "mcs-final-section" }, l("h3", {}, e), ...t),
  Q = (e) => l("p", { className: "mcs-hint" }, e);
function Kn(e, t, { compact: n = !1 } = {}) {
  return l(
    "div",
    { className: "mcs-form-flow" },
    U({ label: "로어북 이름", control: He(e.draft.name, (i) => t.updateBook("name", i), { maxLength: 200 }) }),
    U({
      label: "로어북 설명",
      control: V(
        e.draft.description,
        (i) => t.updateBook("description", i),
        n ? { rows: 1, className: "mcs-textarea mcs-textarea--single", maxLength: 12e3 } : { rows: 2, maxLength: 12e3 },
      ),
    }),
  );
}
function Bi(e, t) {
  return l(
    "details",
    { className: "mcs-advanced mls-overview-details", "data-mcs-details": "lorebook-overview" },
    l("summary", {}, "로어북 개요"),
    l("div", { className: "mcs-advanced__body" }, Kn(e, t)),
  );
}
function ji(e, t) {
  let n = e.input.characterIds.map((a) => e.characters.find((o) => o.id === a)).filter(Boolean),
    i = e.characters.filter((a) => !e.input.characterIds.includes(a.id)),
    r = e.input.characterIds.length >= 3,
    s = [
      { value: "", label: r ? "최대 3명을 선택했습니다" : i.length ? "참고 캐릭터 추가…" : "추가할 캐릭터가 없습니다" },
      ...i.map((a) => ({ value: a.id, label: a.name, disabled: r })),
    ];
  return l(
    "fieldset",
    { className: "mcs-picker-fieldset mcs-world-character-block" },
    l("legend", {}, "참고 캐릭터 (최대 3명)"),
    e.characters.length ? ue("", s, (a) => a && t.addCharacter(a), { disabled: r }) : Q("불러온 기존 캐릭터가 없습니다."),
    n.length
      ? l(
          "div",
          { className: "mcs-selected-reference-list" },
          n.map((a) =>
            l(
              "span",
              { className: "mcs-selected-reference" },
              l("span", { className: "mcs-selected-reference__name" }, a.name),
              C("", {
                variant: "ghost",
                icon: "close",
                ariaLabel: `${a.name} 선택 취소`,
                title: "선택 취소",
                className: "mcs-selected-reference__remove",
                onClick: () => t.removeCharacter(a.id),
              }),
            ),
          ),
        )
      : null,
  );
}
function br(e, t) {
  return l(
    "div",
    { className: "mcs-form-flow" },
    C(t === "briefing" ? "령령에게 바로 요청" : t === "revision" ? "부분 수정 바로 요청" : "최종본 바로 요청", {
      icon: "spark",
      onClick: () => e.request(t, "send"),
    }),
    t === "briefing"
      ? C("브리핑 미리보기", { variant: "secondary", icon: "eye", onClick: () => e.request("briefing", "preview") })
      : null,
  );
}
function Er(e, t) {
  return [
    Ee("RP 입력창에 넣기", "send", (n) => {
      (n.preventDefault(), n.stopPropagation(), e.request(t, "composer"));
    }),
    Ee("요청문 복사", "copy", (n) => {
      (n.preventDefault(), n.stopPropagation(), e.request(t, "copy"));
    }),
  ];
}
function qi(e, t) {
  return [
    Te("로어북 제작 준비"),
    l(
      "div",
      { className: "mcs-form-flow" },
      ve(
        [
          { value: "free", label: "자유", accessibleLabel: "자유 제작" },
          { value: "world", label: "참고", accessibleLabel: "기존 자료 참고" },
          { value: "edit", label: "편집", accessibleLabel: "기존 로어북 편집" },
        ],
        e.input.mode,
        (n) => t.updateInput("mode", n, !0),
        "제작 방식",
      ),
      e.input.mode === "world" ? fr(e, t) : null,
      e.input.mode === "edit"
        ? l(
            "div",
            { className: "mcs-form-flow mls-edit-prepare" },
            l(
              "div",
              { className: "mcs-world-selectors mls-edit-source-row" },
              l(
                "div",
                { className: "mcs-world-lorebook-block" },
                U({
                  label: "수정 로어북 선택",
                  control: ue(
                    e.input.editLorebookId,
                    [{ value: "", label: "수정할 로어북 선택…" }, ...e.lorebooks.map((n) => ({ value: n.id, label: n.name }))],
                    (n) => t.updateInput("editLorebookId", n, !0),
                  ),
                }),
              ),
              ji(e, t),
              pr(e, t),
            ),
            U({
              label: "요청 사항",
              control: V(e.input.editRequest, (n) => t.updateInput("editRequest", n), {
                rows: 1,
                className: "mcs-textarea mcs-textarea--single",
                placeholder: "편집하면서 반영하고 싶은 요청이 있다면 적어 주세요.",
                maxLength: 12e3,
              }),
            }),
            C("편집 바로 이동", { icon: "book", wide: !0, disabled: !e.input.editLorebookId, onClick: t.loadOriginal }),
          )
        : l(
            "div",
            { className: "mcs-form-flow" },
            Kn(e, t, { compact: !0 }),
            U({
              label: "추가 요청",
              control: V(e.input.idea, (n) => t.updateInput("idea", n), {
                rows: 2,
                className: "mcs-textarea mcs-textarea--double",
                placeholder: "세계관, 장소, 인물, 규칙 등 만들고 싶은 설정",
                maxLength: 12e3,
              }),
            }),
            l(
              "div",
              { className: "mcs-final-section mls-no-bottom-divider" },
              tt("RP방으로 넘기기", ...Er(t, "briefing")),
              br(t, "briefing"),
              e.briefing ? V(e.briefing, null, { readOnly: !0, rows: 5, "aria-label": "로어북 브리핑 미리 보기" }) : null,
            ),
          ),
    ),
  ];
}
function Jn(e, t, { noBottomDivider: n = !1 } = {}) {
  return l(
    "div",
    { className: `mcs-final-section${n ? " mls-no-bottom-divider" : ""}` },
    l("h3", {}, "답변 가져오기"),
    Q(
      e.pending
        ? `대기 중: ${e.pending.kind === "revision" ? "부분 수정" : "최종본"} 응답`
        : "마지막 답변 가져오기는 최종본·수정 요청 후 사용할 수 있습니다. 직접 붙여넣기는 바로 사용할 수 있습니다.",
    ),
    C(e.pending?.kind === "revision" ? "수정 반영하기" : "마지막 답변 가져오기", {
      icon: "download",
      onClick: t.importLatest,
      disabled: !e.pending,
    }),
    l(
      "details",
      { className: "mcs-advanced", "data-mcs-details": "lore-manual" },
      l("summary", {}, "답변 직접 붙여넣기"),
      l(
        "div",
        { className: "mcs-advanced__body" },
        V(e.manualText, t.manual, { rows: 6, "aria-label": "로어북 답변 직접 붙여넣기" }),
        C("붙여넣은 답변 가져오기", { variant: "secondary", onClick: t.importManual }),
      ),
    ),
  );
}
function Ui(e, t) {
  return l(
    "div",
    { className: "mcs-field" },
    ur("로어북 엔트리 분량", ge, "lorebook-length-help"),
    ve(
      Object.entries(ge).map(([n, i]) => ({ value: n, label: i.label })),
      e.entryAmountMode,
      t.setEntryAmountMode,
      "로어북 엔트리 분량",
    ),
  );
}
function Hi(e, t) {
  return [
    Te("령령과 로어북 제작"),
    Q("RP방에서 설정을 함께 다듬은 뒤 최종본을 요청해 주세요."),
    l("div", { className: "mcs-final-section" }, tt("최종본 요청", ...Er(t, "export")), Ui(e, t), br(t, "export")),
    Jn(e, t, { noBottomDivider: !0 }),
  ];
}
function Fi(e, t) {
  return l(
    "div",
    { className: "mls-token-area" },
    l(
      "div",
      { className: "mcs-token-toolbar" },
      l("span", { className: "mcs-character-summary__token-total mls-entry-total" }, `${e.draft.entries.length}개 Entry ·`),
      l("span", { className: "mcs-character-summary__token-total", "data-lore-total-tokens": "" }, nr(e)),
      C("", {
        variant: "ghost",
        icon: "settings",
        className: "mcs-token-settings-button",
        ariaLabel: "로어북 토큰 추정 설정",
        title: "토큰 추정 설정",
        onClick: t.toggleTokenSettings,
      }),
    ),
    e.tokenSettingsOpen
      ? l(
          "div",
          { className: "mcs-token-settings mls-token-settings" },
          U({
            label: "로어북 추정 토큰 기준",
            control: ue(
              e.tokenProfile,
              Object.entries(Z).map(([n, i]) => ({ value: n, label: i.label })),
              t.setTokenProfile,
            ),
          }),
          Q("전체 Entry 본문 합계입니다. 이름·타입·주요 키·설명은 제외하며, 실제 토크나이저와 차이가 날 수 있습니다."),
        )
      : null,
  );
}
function Gi(e, t) {
  return l(
    "div",
    { className: "mcs-form-flow mls-context-toggles" },
    l(
      "div",
      { className: "mcs-final-section mcs-reference-toggle-section" },
      rt({
        title: "참고 자료 상시 주입",
        description: "1단계의 제작 정보와 선택한 내부·외부 참고 자료를 이 RP방의 새 답변에 계속 전달합니다.",
        checked: e.referenceContext.enabled,
        onChange: t.setReferenceContext,
        helpId: "lorebook-reference-help",
      }),
      e.referenceContext.enabled && e.referenceContext.chatId !== e.activeChatId
        ? Q("다른 RP방에 연결되어 있습니다. 이 방에 연결하려면 토글을 껐다 켜세요.")
        : null,
    ),
    rt({
      title: "현재 로어북 상시 주입",
      description: "3단계 편집창의 최신 로어북 내용을 이 RP방의 새 답변에 계속 전달합니다.",
      checked: e.currentLorebookContext.enabled,
      onChange: t.setCurrentLorebookContext,
      helpId: "lorebook-current-prompt-help",
    }),
    e.currentLorebookContext.enabled && e.currentLorebookContext.chatId !== e.activeChatId
      ? Q("상시 주입: 다른 RP방에 연결되어 있습니다. 이 방에 연결하려면 토글을 껐다 켜세요.")
      : null,
  );
}
function Vi(e, t) {
  return [
    l(
      "div",
      { className: "mcs-heading-row" },
      l(
        "div",
        { className: "mcs-section-heading" },
        l(
          "div",
          { className: "mcs-edit-title-row" },
          l("h2", {}, "로어북 편집"),
          l(
            "div",
            { className: "mcs-heading-actions mls-history-actions" },
            C("이전", { variant: "secondary", icon: "undo", disabled: !e.undo.length || !!e.entryMoveOrder, onClick: t.undo }),
            C("복원", { variant: "secondary", icon: "redo", disabled: !e.redo.length || !!e.entryMoveOrder, onClick: t.redo }),
          ),
        ),
        Fi(e, t),
      ),
    ),
    Gi(e, t),
    Bi(e, t),
    l(
      "div",
      {
        className: `mls-entry-list${e.entryMoveOrder ? " is-reordering" : ""}`,
        "data-mcs-scroll": e.entryMoveOrder ? "entry-reorder-list" : void 0,
      },
      (e.entryMoveOrder
        ? e.entryMoveOrder.map((n) => e.draft.entries.find((i) => i.studioId === n)).filter(Boolean)
        : e.draft.entries
      ).map((n, i) => {
        let r = n.data,
          s = e.openEntries.includes(n.studioId);
        return e.entryMoveOrder
          ? l(
              "div",
              { className: "mls-entry-move-row", "data-lore-entry": n.studioId },
              l("span", { className: "mls-entry-move-name" }, `${i + 1}. ${r.name || "이름 없는 Entry"}`),
              C("", {
                variant: "ghost",
                icon: "up",
                ariaLabel: `${r.name || `Entry ${i + 1}`} 위로 이동`,
                title: "위로 이동",
                disabled: i === 0,
                onClick: () => t.moveEntry(n.studioId, -1),
              }),
              C("", {
                variant: "ghost",
                icon: "down",
                ariaLabel: `${r.name || `Entry ${i + 1}`} 아래로 이동`,
                title: "아래로 이동",
                disabled: i === e.entryMoveOrder.length - 1,
                onClick: () => t.moveEntry(n.studioId, 1),
              }),
            )
          : l(
              "section",
              { className: "mls-entry", "data-lore-entry": n.studioId },
              l(
                "div",
                { className: "mls-entry-header" },
                C(`${i + 1}. ${r.name || "이름 없는 Entry"}`, {
                  variant: "ghost",
                  icon: "chevron",
                  ariaLabel: `Entry ${i + 1} ${s ? "접기" : "펼치기"}`,
                  className: `mls-entry-toggle${s ? " is-open" : ""}`,
                  onClick: () => t.toggle(n.studioId),
                }),
                C("", {
                  variant: "ghost",
                  icon: "copy",
                  title: "Entry 복제",
                  ariaLabel: `Entry ${i + 1} 복제`,
                  onClick: () => t.duplicate(n.studioId),
                }),
                C("", {
                  variant: "ghost",
                  icon: "close",
                  title: "Entry 삭제",
                  ariaLabel: `Entry ${i + 1} 삭제`,
                  onClick: () => t.remove(n.studioId),
                }),
              ),
              s
                ? l(
                    "div",
                    { className: "mls-entry-body" },
                    U({ label: "이름", control: He(r.name, (a) => t.entryField(n.studioId, "name", a), { maxLength: 200 }) }),
                    U({
                      label: "타입",
                      control: ue(
                        pt(r),
                        [
                          { value: "normal", label: "키워드 (Normal)" },
                          { value: "constant", label: "상시 (Constant)" },
                          { value: "selective", label: "선택 조건 (Selective)" },
                        ],
                        (a) => t.entryField(n.studioId, "type", a),
                      ),
                    }),
                    U({
                      label: "주요키(쉼표 구분)",
                      control: V(
                        (r.keys || []).join(", "),
                        (a) =>
                          t.entryField(
                            n.studioId,
                            "keys",
                            a
                              .replace(/\r?\n+/g, ", ")
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean),
                          ),
                        {
                          rows: 1,
                          className: "mcs-textarea mcs-textarea--single mls-keys-single",
                          onKeyDown: (a) => {
                            a.key === "Enter" && a.preventDefault();
                          },
                        },
                      ),
                    }),
                    U({
                      label: "설명",
                      control: V(r.description, (a) => t.entryField(n.studioId, "description", a), {
                        rows: 1,
                        className: "mcs-textarea mcs-textarea--single mls-description-single",
                      }),
                    }),
                    U({
                      label: l(
                        "span",
                        { className: "mls-content-label" },
                        "본문",
                        l(
                          "span",
                          {
                            className: "mcs-editor-token-count mls-body-token-inline",
                            "data-lore-body-tokens": n.studioId,
                            "aria-hidden": "true",
                          },
                          or(n, e.tokenProfile),
                        ),
                      ),
                      control: V(r.content, (a) => t.entryField(n.studioId, "content", a), { rows: 7 }),
                    }),
                  )
                : null,
            );
      }),
    ),
    l(
      "div",
      { className: "mls-entry-add-row" },
      C("Entry 추가", { icon: "book", onClick: t.addEntry, disabled: !!e.entryMoveOrder }),
      C(e.entryMoveOrder ? "이동 취소" : "Entry 이동", {
        variant: "secondary",
        icon: "reorder",
        onClick: t.toggleEntryMove,
        disabled: e.draft.entries.length < 2,
      }),
      e.entryMoveOrder ? C("확인", { variant: "secondary", icon: "check", onClick: t.confirmEntryMove }) : null,
    ),
    l(
      "details",
      { className: "mcs-advanced mcs-revision-details", "data-mcs-details": "lorebook-revision-request" },
      l("summary", {}, l("span", {}, "부분 수정 요청"), l("span", { className: "mcs-revision-quick-actions" }, Er(t, "revision"))),
      l(
        "div",
        { className: "mcs-advanced__body" },
        l(
          "div",
          { className: "mcs-field" },
          V(e.revision, t.revision, {
            "aria-label": "령령에게 수정할 내용",
            rows: 3,
            placeholder: "예: 항구 Entry의 야시장 설정만 보완해줘",
          }),
        ),
        br(t, "revision"),
      ),
    ),
    l("div", { className: "mls-step-divider", "aria-hidden": "true" }),
    Jn(e, t, { noBottomDivider: !0 }),
  ];
}
function Ki(e, t) {
  let n = ft(e.draft),
    i = e.registered?.original === !1 && e.registered.fingerprint === Y(e.draft),
    r;
  try {
    r = e.source ? mt(e.draft, e.source) : null;
  } catch {}
  return [
    Te("로어북 최종 저장"),
    yr(
      e.draft.name || "이름 없는 로어북",
      Q(`${e.draft.entries.length}개 Entry`),
      Q(e.draft.description),
      r ? Q(`원본 대비 수정 ${r.patches.length}개 · 추가 ${r.additions.length}개 · 삭제 ${r.deletions.length}개`) : null,
      n.length
        ? l(
            "ul",
            { className: "mcs-error" },
            n.map((s) => l("li", {}, s)),
          )
        : e.recovery
          ? null
          : Q("저장할 준비가 되었습니다."),
    ),
    e.recovery
      ? yr(
          "저장 결과 확인 필요",
          l(
            "p",
            { className: "mcs-error" },
            `저장이 일부 반영되었을 수 있습니다. 중복 저장을 막기 위해 재시도를 차단했습니다. 대상: ${e.recovery.target || "새 로어북 ID 미확인"}`,
          ),
          Q(`완료 ${e.recovery.completed.length}건 · 마지막 작업: ${e.recovery.inFlight || e.recovery.completed.at(-1) || "확인 중"}`),
          Q(
            "현재 작업을 임시 저장하고 Marinara 라이브러리에서 결과를 확인해 주세요. 필요하면 상단 초기화 버튼으로 로어북 제작실 작업을 초기화한 뒤 서버 원본을 다시 불러올 수 있습니다.",
          ),
        )
      : null,
    e.registered ? Q(`최근 저장 대상 · ${e.registered.id}`) : null,
    l(
      "div",
      { className: "mcs-completion-actions" },
      yr(
        "마리나라에 바로 저장",
        C("새 로어북으로 등록", { icon: "book", disabled: !!n.length || !!e.recovery || i, onClick: () => t.save(!1) }),
        e.source ? C("원본 로어북에 저장", { icon: "save", disabled: !!n.length || !!e.recovery, onClick: () => t.save(!0) }) : null,
      ),
      l(
        "div",
        { className: "mcs-final-section mls-no-bottom-divider" },
        l("h3", {}, "파일로 저장"),
        C("로어북 JSON 저장", { variant: "secondary", icon: "download", onClick: t.download }),
        C("JSON 전체 복사", { variant: "secondary", icon: "copy", onClick: t.copyJson }),
      ),
    ),
  ];
}
function Xn(e, t, n, i) {
  let r = mr(t, { goStep: n.goStep });
  r.setAttribute("aria-label", "로어북 제작 단계");
  let s = l("section", { className: "mcs-step-panel", tabindex: "-1" }, ...[qi, Hi, Vi, Ki][t.step](t, n)),
    a = l("fieldset", { className: "mls-lock", disabled: t.busy }, s);
  Qe(
    e,
    l(
      "div",
      { className: "mcs-overlay" },
      l(
        "div",
        { className: "mcs-shell" },
        dr("lorebook", { ...i, clearTemporary: n.clearTemporary, saveTemporary: n.persist }, t.busy),
        r,
        l(
          "main",
          { className: "mcs-main" },
          t.error ? l("p", { className: "mcs-error mls-message", role: "alert" }, t.error) : null,
          t.notice ? l("p", { className: "mcs-hint mls-message", role: "status" }, t.notice) : null,
          t.busy ? Q("처리 중…") : null,
          a,
        ),
        l("div", { className: "mcs-resizer", role: "separator", "aria-label": "제작실 창 크기 조절" }),
      ),
    ),
  );
}

export { $i, Bi, Bn, C, Ci, Di, Dn, Ee, Er, Fi, Fn, Gi, Gn, He, Hi, Hn, Ii, Jn, Ki, Kn, Li, Mi, Ni, Oi, Pi, Q, Qe, Te, Ti, U, Ue, Ui, Un, V, Vi, Vn, Xn, _i, be, br, cr, dr, et, fr, gr, hr, ji, jn, l, lr, mr, pr, qi, qn, rt, sr, tt, ue, ur, ve, yr };
