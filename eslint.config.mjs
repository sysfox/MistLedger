import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * `mistledger/no-taboo-classnames` — DESIGN.md §十一 turned into a machine guard.
 *
 * Class names are often assembled at runtime (`` `text-${RAMP}-500` ``, `+` concat,
 * `cn(...)`); a rule that only regexes string literals passes all of those. So this one
 * folds the expression — statically evaluating what it can from same-file `const`s — and
 * scans the *result*. Two load-bearing rules follow:
 *
 * 1. A hole in a banned slot is a finding, a hole anywhere else is not: `{"text-" + t}`
 *    could be `zinc`, but `{"panel " + t}` is idiomatic prop pass-through.
 * 2. Arithmetic is not concatenation: `500 + "-" + RAMP2` is the number five hundred,
 *    not "500-"; folding it as a string invents taboos that do not exist.
 */

// The taboo list itself (§十一 #1 / #5 / #6).

/** §十一#6 — Tailwind gray ramps. The banned ones, per DESIGN.md. */
const GRAY_RAMPS = ["zinc", "slate", "neutral", "stone", "gray"];

/** §十一#1 — the standard palette. Semantic color is ember/jade/lamp only. */
const STANDARD_COLORS = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

/**
 * Importing a palette package is the same violation as using one class from
 * it — it exists only to reach the banned colors.
 */
const BANNED_PALETTE_MODULES = new Set([
  "tailwindcss/colors",
  "tailwindcss/defaultTheme",
  "tailwindcss/default-theme",
  "@tailwindcss/colors",
]);

/** JSX attributes (and object keys) that carry a class list. */
const CLASS_NAME_KEYS = new Set(["className", "class"]);

/** Merging helpers: every argument is a class fragment, concatenated. */
const CLASS_MERGE_FNS = new Set(["cn", "cx", "clsx"]);

/**
 * String methods that derive a new string from the receiver. The receiver is
 * the value the author was really assembling, so it is what we scan; the
 * arguments are scanned too, because they can carry a taboo token themselves
 * (`"panel".replace("panel", "text-zinc-500")`).
 */
const STRING_DERIVING_METHODS = new Set([
  "replace", "replaceAll", "trim", "trimStart", "trimEnd", "padStart", "padEnd",
  "slice", "substring", "toLowerCase", "toUpperCase", "normalize", "concat",
]);

/**
 * Array methods that do not change *which* elements survive, only their order or multiplicity.
 * Peeling them is a deliberate over-approximation: `sort()` could reorder `["500","text-zinc"]`
 * into a real `text-zinc-500`, and pretending otherwise would make the guard trivially bypassable.
 */
const ARRAY_PEELING_METHODS = new Set([
  "map", "flatMap", "filter", "reverse", "sort", "slice", "reduce", "splice",
  "toSorted", "toReversed",
]);

/** How many template-literal substitutions deep the folder will follow. */
const MAX_INTERPOLATION_HOPS = 1;

/**
 * Stands in for "a value this rule could not resolve", inside a folded
 * string. It is stripped before the class scan and inspected by the slot scan
 * — see the two design rules at the top of this file.
 */
// Written as an escape so the file stays text: a literal NUL makes git treat
// the whole config as binary and kills diffs on this rule.
const HOLE = "\u0000";

/** Belt and braces against a pathological expression exploding the folder. */
const MAX_ALTERNATIVES = 32;

// The taboo matchers.

/**
 * A color class is `[variants:]utility-ramp-shade[/opacity]`, anchored to a whitespace
 * boundary and requiring a numeric shade. Both halves are load-bearing: the boundary
 * keeps `500-text-zinc` (malformed, not a violation) out; the shade requirement keeps a
 * bare `text-zinc` — not a real Tailwind class — from tripping the guard. `utility` may
 * not be empty, so `text--zinc-500` (doubled separator from a `join("-")` over
 * already-split fragments) is not a class either.
 */
function colorMatcher(names) {
  return new RegExp(
    // Each prefix segment must start alphanumeric, so `text--zinc-500` does not
    // parse as `text-` plus `-zinc-500`. [B2]
    `(?:^|\\s)(?:[a-z][a-z0-9-]*:)*[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:${names.join("|")})-\\d{2,3}(?:/\\d+)?(?=\\s|$)`,
    "g",
  );
}

const GRAY_MATCHER = colorMatcher(GRAY_RAMPS);
const STANDARD_MATCHER = colorMatcher(STANDARD_COLORS);

/** §十一#5 — a `dark:` variant, matched as a whole variant segment. */
const DARK_MATCHER = /(?:^|\s)dark:/g;

/**
 * Does an unresolved hole sit exactly where a banned ramp/shade/variant would go? Two shapes
 * qualify: the hole directly follows a utility's trailing dash (`text-` + hole), or is directly
 * followed by a shade (`-500`) or a variant boundary (`:bg-veil`). A doubled separator
 * (`text--` + hole) is deliberately excluded — that token is not a class.
 */
function holeIsInBannedSlot(pattern, index) {
  const before = pattern.slice(0, index);
  if (/[a-zA-Z]-$/.test(before)) return true;
  const after = pattern.slice(index + 1);
  return /^-\d/.test(after) || /^:/.test(after);
}

// Folding: turn an expression into the string(s) it evaluates to.

const hole = () => ({ kind: "hole" });
const str = (pats) => ({ kind: "str", pats: Array.isArray(pats) ? pats : [pats] });
const arr = (items) => ({ kind: "arr", items });
const obj = (props) => ({ kind: "obj", props });

function patternsOf(value) {
  return value.kind === "str" ? value.pats : value.kind === "hole" ? [HOLE] : [];
}

function crossJoin(groups, separator) {
  let out = [""];
  for (const group of groups) {
    const next = [];
    for (const prefix of out) {
      for (const suffix of group) {
        next.push(prefix + suffix);
        if (next.length >= MAX_ALTERNATIVES) break;
      }
      if (next.length >= MAX_ALTERNATIVES) break;
    }
    out = next;
  }
  return out.map((s) => (s.length > 0 ? s : separator));
}

/** Property name of `node`, or `null` when it is not a static key. */
function keyName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  // A computed numeric index (`K[0]`, `arr[i]`) is a key too — without this a
  // literal subscript folds to `undefined` and the taboo behind it is missed.
  if (node.type === "Literal" && typeof node.value === "number") return String(node.value);
  return null;
}

/**
 * Concatenate groups *in order*, with `separator` between neighbours. Each
 * group is a list of alternatives; the result is every combination, joined
 * sequentially. `crossJoin` is the wrong tool whenever the pieces are
 * sequential rather than mutually exclusive — it reads `["a","b"]` as
 * "a or b" instead of "ab".
 */
function concatGroups(groups, separator) {
  let out = [""];
  for (let i = 0; i < groups.length; i++) {
    const next = [];
    for (const prefix of out) {
      for (const piece of groups[i]) {
        next.push(i === 0 ? prefix + piece : prefix + separator + piece);
        if (next.length >= MAX_ALTERNATIVES) break;
      }
      if (next.length >= MAX_ALTERNATIVES) break;
    }
    out = next;
  }
  return out;
}

/** `(s) => s` — the identity callback that `.map()` can be peeled through. */
function isIdentityCallback(arg) {
  if (arg?.type !== "ArrowFunctionExpression") return false;
  if (arg.params.length !== 1 || arg.params[0].type !== "Identifier") return false;
  return arg.body.type === "Identifier" && arg.body.name === arg.params[0].name;
}

/** `(a, b) => [...a, b]` — the accumulator `reduce` can be peeled through. */
function isAppendCallback(arg) {
  if (arg?.type !== "ArrowFunctionExpression") return false;
  if (arg.params.length !== 2) return false;
  if (arg.params.some((p) => p.type !== "Identifier")) return false;
  const [first, second] = arg.params.map((p) => p.name);
  const seen = new Set();
  const body = arg.body;
  if (body?.type !== "ArrayExpression") return false;
  for (const element of body.elements) {
    if (!element) return false;
    // `(a, b) => [...a, b]` is as common as `[...a, ...b]`: the accumulator may
    // be spread while the incoming item is appended bare.
    const inner = element.type === "SpreadElement" ? element.argument : element;
    if (inner?.type !== "Identifier") return false;
    seen.add(inner.name);
  }
  return seen.has(first) && seen.has(second);
}

/**
 * Build the folder. It needs the file's own `const` bindings, because a class
 * assembled through a named constant is the most common shape of all —
 * `` const RAMP = "zinc" `` then `` `text-${RAMP}-500` ``.
 */
function createFolder(context) {
  const source = context.sourceCode;
  const bindings = new Map();
  for (const statement of source.ast.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declarator of statement.declarations) {
      if (declarator.id.type !== "Identifier" || !declarator.init) continue;
      bindings.set(declarator.id.name, declarator);
    }
  }

  function fold(node, depth, path) {
    if (!node) return hole();

    switch (node.type) {
      // ---- leaves -------------------------------------------------------
      case "Literal":
        if (typeof node.value === "string") return str(node.value);
        if (typeof node.value === "number" || typeof node.value === "bigint") {
          return str(String(node.value));
        }
        return hole();

      case "TemplateLiteral": {
        // [E4] Each substitution is one hop. Past the limit the value is a
        // hole — a `const` that is itself a template is a real boundary, and
        // guessing past it is how a guard starts crying wolf.
        if (depth >= MAX_INTERPOLATION_HOPS) return hole();

        // A template is a *sequence*, not a set of alternatives: the result is
        // quasi[0] + expr[0] + quasi[1] + ... + quasi[n], each expression
        // contributing its own alternatives. crossJoin() would take the cross
        // product and read `text-${X}-500` as "text-" or "X" or "500".
        const text = (index) =>
          node.quasis[index].value.cooked ?? node.quasis[index].value.raw ?? "";

        let alternatives = [""];
        for (let i = 0; i < node.expressions.length; i++) {
          const before = text(i);
          const inner = patternsOf(fold(node.expressions[i], depth + 1, path));
          const next = [];
          for (const prefix of alternatives) {
            for (const suffix of inner) {
              next.push(prefix + before + suffix);
              if (next.length >= MAX_ALTERNATIVES) break;
            }
            if (next.length >= MAX_ALTERNATIVES) break;
          }
          alternatives = next;
        }

        const tail = node.quasis.length > 0 ? text(node.quasis.length - 1) : "";
        return str(alternatives.map((value) => value + tail));
      }

      case "TaggedTemplateExpression":
        // `String.raw` / a project's own `tw` are still a template underneath.
        return fold(node.quasi, depth, path);

      // ---- transparent carriers ------------------------------------------
      case "ChainExpression":
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSInstantiationExpression":
        return fold(node.expression, depth, path);

      case "ParenthesizedExpression":
        return fold(node.expression, depth, path);

      case "SequenceExpression":
        // The value of `(a, b, c)` is `c`.
        return fold(node.expressions[node.expressions.length - 1], depth, path);

      // ---- concatenation --------------------------------------------------
      case "BinaryExpression":
        if (node.operator !== "+") return hole();
        return str(
          crossJoin(
            [
              patternsOf(fold(node.left, depth, path)),
              patternsOf(fold(node.right, depth, path)),
            ],
            "",
          ),
        );

      case "UnaryExpression": {
        // A negative shade (`"text-zinc" + -500`) is a UnaryExpression, not a
        // Literal. [A5]
        const argument = fold(node.argument, depth, path);
        if (argument.kind !== "str" || node.operator !== "-") return argument;
        return str(argument.pats.map((p) => (p === HOLE ? HOLE : String(-Number(p)))));
      }

      case "ConditionalExpression":
        // Both branches are possible values; both have to be scanned.
        return str([
          ...patternsOf(fold(node.consequent, depth, path)),
          ...patternsOf(fold(node.alternate, depth, path)),
        ]);

      case "LogicalExpression": {
        // `a || b` yields `b` whenever `a` cannot be resolved — which is the
        // shape every `x || "text-…"` default takes. [R8]
        const left = fold(node.left, depth, path);
        const leftPatterns = patternsOf(left);
        if (leftPatterns.every((p) => p === HOLE)) {
          return fold(node.right, depth, path);
        }
        return left;
      }

      // ---- literals in containers ----------------------------------------
      case "ArrayExpression":
        return arr(node.elements.map((element) => fold(element, depth, path)));

      case "ObjectExpression": {
        const props = new Map();
        for (const property of node.properties) {
          if (property.type === "Property") {
            const name = keyName(property.key);
            if (name !== null) props.set(name, fold(property.value, depth, path));
          } else if (property.type === "SpreadElement") {
            // `{ ...M2 }` folds to M2, so `{ ...M2 }.a` resolves. [R30]
            const inner = fold(property.argument, depth, path);
            if (inner.kind === "obj") {
              for (const [name, value] of inner.props) props.set(name, value);
            }
          }
        }
        return obj(props);
      }

      // ---- references ----------------------------------------------------
      case "Identifier": {
        if (node.name === "undefined") return str("undefined");
        const declarator = bindings.get(node.name);
        if (!declarator || path.has(declarator)) return hole();
        path.add(declarator);
        const value = fold(declarator.init, depth, path);
        path.delete(declarator);
        return value;
      }

      case "MemberExpression": {
        if (node.computed && node.property.type !== "Literal") return hole();
        const target = fold(node.object, depth, path);
        const name = keyName(node.property);
        if (name === null) return hole();
        if (target.kind === "obj") return target.props.get(name) ?? hole();
        if (target.kind === "arr") {
          const index = Number(name);
          if (!Number.isInteger(index)) return hole();
          // A computed index into an array is a hole when it is not a literal
          // — but an out-of-range literal is `undefined`, i.e. a hole too.
          return target.items[index] ?? hole();
        }
        return hole();
      }

      // ---- calls ----------------------------------------------------------
      case "CallExpression": {
        // `cn(...)` and friends merge their arguments into one class.
        if (node.callee.type === "Identifier" && CLASS_MERGE_FNS.has(node.callee.name)) {
          // The arguments of a class-merger land *side by side*, so the groups
          // concatenate in order. crossJoin() would read cn("text-","zinc") as
          // "text-" or "zinc" and miss the class they spell together.
          return str(
            concatGroups(
              node.arguments.map((argument) => patternsOf(foldArgument(argument, depth, path))),
              "",
            ),
          );
        }

        const member = node.callee;
        if (member?.type !== "MemberExpression" || member.computed) return hole();
        if (member.object.type === "Super") return hole();
        const method = member.property.type === "Identifier" ? member.property.name : null;
        if (method === null) return hole();
        const target = fold(member.object, depth, path);

        if (target.kind === "arr" && method === "join") {
          // One group per element; a template-style sequential fold with the
          // separator wedged between neighbours. crossJoin() cannot do this —
          // it concatenates with nothing between.
          const groups = target.items.map((item) =>
            item.kind === "str" ? item.pats : item.kind === "arr" ? patternsOf(arrToString(item)) : [HOLE],
          );
          const separatorNode = node.arguments[0];
          const sepPatterns = separatorNode ? patternsOf(fold(separatorNode, depth, path)) : [""];

          const out = [];
          for (const separator of sepPatterns) {
            for (const value of concatGroups(groups, separator)) out.push(value);
            // [G2] The separator is a class of its own: `["a","b"].join("-zinc-500")`
            // puts a taboo in the gap even when neither end is one.
            if (separator !== HOLE && separator !== "") out.push(separator);
            if (out.length >= MAX_ALTERNATIVES) break;
          }
          if (out.length > MAX_ALTERNATIVES) out.length = MAX_ALTERNATIVES;
          return str(out);
        }

        if (target.kind === "arr" && method === "concat") {
          const merged = [...target.items];
          for (const argument of node.arguments) {
            const value = foldArgument(argument, depth, path);
            if (value.kind === "arr") merged.push(...value.items);
            else if (value.kind === "str") merged.push(value);
          }
          return arr(merged);
        }

        if (target.kind === "str" && method === "split") {
          // Only a fully concrete string splits into known parts; anything with
          // a hole in it does not. [D3]
          const sepNode = node.arguments[0];
          const sep = sepNode ? fold(sepNode, depth, path) : str("");
          const items = [];
          for (const pattern of patternsOf(sep)) {
            if (pattern === HOLE) return hole();
            for (const value of target.pats) {
              if (value === HOLE) return hole();
              for (const piece of value.split(pattern)) items.push(str(piece));
            }
          }
          return arr(items);
        }

        if (target.kind === "str" && STRING_DERIVING_METHODS.has(method)) {
          // The receiver is the value being assembled. The arguments are
          // scanned alongside it, because they can carry the taboo. [C2]
          return str([
            ...target.pats,
            ...node.arguments.flatMap((argument) => patternsOf(foldArgument(argument, depth, path))),
          ]);
        }

        if (target.kind === "arr" && ARRAY_PEELING_METHODS.has(method)) {
          const callback = node.arguments[0];
          if (method === "map" || method === "flatMap") {
            return isIdentityCallback(callback) ? target : hole();
          }
          if (method === "reduce") {
            return isAppendCallback(callback) ? target : hole();
          }
          return target;
        }

        return hole();
      }

      default:
        return hole();
    }
  }

  /** `...K` inside a call folds to the array it names. */
  function foldArgument(argument, depth, path) {
    if (argument.type === "SpreadElement") {
      const value = fold(argument.argument, depth, path);
      if (value.kind === "arr") {
        // `cn(...K)` puts the array's elements next to each other; they are not
        // alternatives of one value.
        return str(concatGroups(value.items.map((item) => patternsOf(item)), ""));
      }
      return hole();
    }
    return fold(argument, depth, path);
  }

  /** `String(arrayValue)` — what `join` produces for a nested array. */
  function arrToString(value) {
    return str(
      value.items.flatMap((item) => (item.kind === "str" ? item.pats : [item.kind === "arr" ? arrToString(item).pats[0] : HOLE])),
    );
  }

  return function foldRegion(node) {
    return patternsOf(fold(node, 0, new Set()));
  };
}

// The rule.

const noTabooClassnames = {
  meta: {
    type: "problem",
    docs: {
      description: "DESIGN.md §十一 禁忌清单的机器守卫：灰阶、标准色与 dark: 变体一律禁止",
    },
    schema: [],
    messages: {},
  },

  create(context) {
    const source = context.sourceCode;
    const fold = createFolder(context);

    /** Report each distinct finding once per region. */
    function reportOnce(region, seen, message) {
      if (seen.has(message)) return;
      seen.add(message);
      context.report({ node: region, message });
    }

    function scanClassExpression(node, seen) {
      for (const pattern of fold(node)) {
        // A hole is *stripped* here: the class scan judges what the fragments
        // between the holes could spell out, and the slot scan below judges
        // the holes themselves.
        const joined = pattern.split(HOLE).join("");

        for (const match of joined.matchAll(GRAY_MATCHER)) {
          const ramp = GRAY_RAMPS.find((name) => match[0].includes(`-${name}-`));
          reportOnce(
            node,
            seen,
            `DESIGN.md §十一#6 禁用 ${ramp ?? "zinc"} 灰阶，请用 night/mist/veil/fogline/dim 令牌。`,
          );
        }
        for (const match of joined.matchAll(STANDARD_MATCHER)) {
          const color = STANDARD_COLORS.find((name) => match[0].includes(`-${name}-`));
          reportOnce(
            node,
            seen,
            `DESIGN.md §十一#1 禁用标准色 ${match[0].trim()}（${color}），语义色只有 ember/jade/lamp。`,
          );
        }
        if (DARK_MATCHER.test(joined)) {
          DARK_MATCHER.lastIndex = 0;
          reportOnce(node, seen, "DESIGN.md §十一#5 禁用 dark: 变体，全站常夜。");
        } else {
          DARK_MATCHER.lastIndex = 0;
        }

        // The holes: only the ones sitting in a banned slot are findings.
        for (let i = 0; i < pattern.length; i++) {
          if (pattern[i] !== HOLE) continue;
          if (!holeIsInBannedSlot(pattern, i)) continue;
          const text = source.getText(node).replace(/\s+/g, " ").slice(0, 60);
          reportOnce(
            node,
            seen,
            `DESIGN.md §十一 禁忌类名无法静态解析（${text}）。` +
              "请把它提取为同文件的 const 字面量，让 lint 能真正校验它。",
          );
          break;
        }
      }
    }

    /**
     * Class regions also contain callbacks (`.map(s => "text-" + s)`), and
     * the whole string is assembled inside them. Those bodies are class
     * regions too.
     */
    function scanWithCallbacks(node, seen) {
      scanClassExpression(node, seen);
      const walk = (current) => {
        if (!current || typeof current.type !== "string") return;
        if (current !== node && (current.type === "ArrowFunctionExpression" || current.type === "FunctionExpression")) {
          if (current.body.type !== "BlockStatement") scanClassExpression(current.body, seen);
          return;
        }
        for (const key of source.visitorKeys[current.type] ?? []) {
          const child = current[key];
          if (Array.isArray(child)) child.forEach(walk);
          else if (child && typeof child.type === "string") walk(child);
        }
      };
      walk(node);
    }

    return {
      ImportDeclaration(node) {
        if (!BANNED_PALETTE_MODULES.has(String(node.source.value))) return;
        context.report({
          node,
          message:
            `DESIGN.md §十一#1 禁止引入外部标准色板（${String(node.source.value)}）—— ` +
            "语义色只有 ember/jade/lamp。",
        });
      },

      // `window.confirm` / `alert` / `prompt` put a browser chrome dialog in
      // front of a page that is otherwise entirely its own design.
      MemberExpression(node) {
        if (node.object.type !== "Identifier" || node.object.name !== "window") return;
        if (node.computed) return;
        if (node.property.type !== "Identifier") return;
        if (node.property.name !== "confirm" && node.property.name !== "alert" && node.property.name !== "prompt") return;
        context.report({
          node,
          message: `DESIGN.md §十一 禁止使用 window.${node.property.name}：原生弹窗与「全站常夜」的设计语言冲突，请改用页内确认组件。`,
        });
      },

      // `<p className={…} />`, `<p class="…" />`, and the object-property form
      // `{...{ className: … }}` both reach here.
      "JSXAttribute[name.name='className'], JSXAttribute[name.name='class']"(node) {
        const value = node.value;
        if (!value) return;
        const seen = new Set();
        if (value.type === "JSXExpressionContainer") scanWithCallbacks(value.expression, seen);
        else if (value.type === "Literal" && typeof value.value === "string") {
          scanClassExpression(value, seen);
        }
      },

      "Property[computed=false]"(node) {
        if (keyName(node.key) === null || !CLASS_NAME_KEYS.has(keyName(node.key))) return;
        if (node.value.type === "Literal" && typeof node.value.value === "string") return; // already covered
        const seen = new Set();
        scanWithCallbacks(node.value, seen);
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      mistledger: {
        rules: {
          "no-taboo-classnames": noTabooClassnames,
        },
      },
    },
    rules: {
      "mistledger/no-taboo-classnames": "error",
    },
  },
]);

export default eslintConfig;
