/* eslint-env node */

module.exports = {
  "env": {
    "es6": true,
    "browser": true,
    "webextensions": true,
    "mozilla/privileged": false
  },
  "extends": [
    "eslint:recommended"
  ],
  "plugins": [
    "no-unsanitized",
    "mozilla"
  ],
  "parserOptions": {
    "ecmaVersion": 11
  },
  "rules": {
    // Warn about cyclomatic complexity in functions.
    "complexity": ["error", 30],

    // Require braces around blocks that start a new line
    "curly": ["error", "all"],

    // Encourage the use of dot notation whenever possible.
    "dot-notation": "error",

    // 2-spaces indentation
    "indent": ["error", 2, {"SwitchCase": 1}],

    // Don't enforce the maximum depth that blocks can be nested. The complexity
    // rule is a better rule to check this.
    "max-depth": "off",

    // Maximum depth callbacks can be nested.
    "max-nested-callbacks": ["error", 10],

    "mozilla/avoid-removeChild": "error",
    "mozilla/consistent-if-bracing": "error",
    "mozilla/import-browser-window-globals": "error",
    "mozilla/import-globals": "error",
    "mozilla/no-compare-against-boolean-literals": "error",
    "mozilla/no-useless-removeEventListener": "error",
    "mozilla/rejects-requires-await": "error",
    "mozilla/use-includes-instead-of-indexOf": "error",
    "mozilla/use-ownerGlobal": "error",
    "mozilla/use-returnValue": "error",

    // Use [] instead of Array()
    "no-array-constructor": "error",

    // Disallow use of arguments.caller or arguments.callee.
    "no-caller": "error",

    // XXX Bug 1487642 - decide if we want to enable this or not.
    // Disallow lexical declarations in case clauses
    "no-case-declarations": "off",

    // XXX Bug 1487642 - decide if we want to enable this or not.
    // Disallow the use of console
    "no-console": "off",

    // XXX Bug 1487642 - decide if we want to enable this or not.
    // Disallow constant expressions in conditions
    "no-constant-condition": "off",

    // No duplicate keys in object declarations
    "no-dupe-keys": "error",

    // If an if block ends with a return no need for an else block
    "no-else-return": "error",

    // No empty statements
    "no-empty": ["error", { allowEmptyCatch: true }],

    // Disallow eval and setInteral/setTimeout with strings
    "no-eval": "error",

    // Disallow unnecessary calls to .bind()
    "no-extra-bind": "error",

    // Disallow fallthrough of case statements
    "no-fallthrough": [
      "error",
      {
        // The eslint rule doesn't allow for case-insensitive regex option.
        // The following pattern allows for a dash between "fall through" as
        // well as alternate spelling of "fall thru". The pattern also allows
        // for an optional "s" at the end of "fall" ("falls through").
        commentPattern:
          "[Ff][Aa][Ll][Ll][Ss]?[\\s-]?([Tt][Hh][Rr][Oo][Uu][Gg][Hh]|[Tt][Hh][Rr][Uu])",
      },
    ],

    // Disallow assignments to native objects or read-only global variables
    "no-global-assign": "error",

    // Disallow eval and setInteral/setTimeout with strings
    "no-implied-eval": "error",

    // This has been superseded since we're using ES6.
    // Disallow variable or function declarations in nested blocks
    "no-inner-declarations": "off",

    // Disallow the use of the __iterator__ property
    "no-iterator": "error",

    // No labels
    "no-labels": "error",

    // Disallow unnecessary nested blocks
    "no-lone-blocks": "error",

    // No single if block inside an else block
    "no-lonely-if": "error",

    // Nested ternary statements are confusing
    "no-nested-ternary": "error",

    // Use {} instead of new Object()
    "no-new-object": "error",

    // Disallow use of new wrappers
    "no-new-wrappers": "error",

    // We don't want this, see bug 1551829
    "no-prototype-builtins": "off",

    // Disable builtinGlobals for no-redeclare as this conflicts with our
    // globals declarations especially for browser window.
    "no-redeclare": ["error", { builtinGlobals: false }],

    // Disallow use of event global.
    "no-restricted-globals": ["error", "event"],

    // Disallows unnecessary `return await ...`.
    "no-return-await": "error",

    // No unnecessary comparisons
    "no-self-compare": "error",

    // No comma sequenced statements
    "no-sequences": "error",

    // No declaring variables from an outer scope
    // "no-shadow": "error",

    // No declaring variables that hide things like arguments
    "no-shadow-restricted-names": "error",

    // Disallow throwing literals (eg. throw "error" instead of
    // throw new Error("error")).
    "no-throw-literal": "error",

    // Disallow the use of Boolean literals in conditional expressions.
    "no-unneeded-ternary": "error",

    // No unsanitized use of innerHTML=, document.write() etc.
    // cf. https://github.com/mozilla/eslint-plugin-no-unsanitized#rule-details
    "no-unsanitized/method": "error",
    "no-unsanitized/property": "error",

    // No declaring variables that are never used
    "no-unused-vars": [
      "error",
      {
        args: "none",
        vars: "local",
      },
    ],

    // No using variables before defined
    // "no-use-before-define": ["error", "nofunc"],

    // Disallow unnecessary .call() and .apply()
    "no-useless-call": "error",

    // Don't concatenate string literals together (unless they span multiple
    // lines)
    "no-useless-concat": "error",

    // XXX Bug 1487642 - decide if we want to enable this or not.
    // Disallow unnecessary escape characters
    "no-useless-escape": "off",

    // Disallow redundant return statements
    "no-useless-return": "error",

    // No using with
    "no-with": "error",

    // Require object-literal shorthand with ES6 method syntax
    "object-shorthand": ["error", "always", { avoidQuotes: true }],

    // This generates too many false positives that are not easy to work around,
    // and false positives seem to be inherent in the rule.
    "require-atomic-updates": "off",

    // XXX Bug 1487642 - decide if we want to enable this or not.
    // Require generator functions to contain yield
    "require-yield": "off",

    // No using var, instead of let/const
    "no-var": "error",

    // Require semicolons
    "semi": "error",
  },

  // To avoid bad interactions of the html plugin with the xml preprocessor in
  // eslint-plugin-mozilla, we turn off processing of the html plugin for .xml
  // files.
  settings: {
    "html/xml-extensions": [".xhtml"],
  },
};
