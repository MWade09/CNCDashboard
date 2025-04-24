/*
  Language: G-code (ISO 6983)
  Contributors: Adam Joseph Cook <adam.joseph.cook@gmail.com>
  Description: G-code syntax highlighting for CNC machining operations
*/

(function() {
  // IIFE to avoid global namespace pollution
  function defineGCode(hljs) {
    return {
      name: 'G-code',
      case_insensitive: true,
      aliases: ['gcode', 'nc'],
      keywords: {
        $pattern: '[A-Z][A-Z0-9+.]*',
        keyword:
          'IF DO WHILE ENDWHILE CALL GOTO SUB ENDSUB ENDIF',
        literal:
          'N G M T F S X Y Z',
      },
      contains: [
        {
          className: 'meta',
          begin: /^O[0-9]+/,
        },
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          className: 'comment',
          begin: /\(/, end: /\)/,
          contains: [hljs.PHRASAL_WORDS_MODE]
        },
        hljs.inherit(hljs.C_NUMBER_MODE, { begin: '([-+]?([0-9]*\\.?[0-9]+\\.?))|' + hljs.C_NUMBER_RE }),
        hljs.inherit(hljs.APOS_STRING_MODE, { illegal: null }),
        hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null }),
        {
          className: 'name',
          begin: /[A-Z]/,
        },
        {
          className: 'keyword',
          begin: /%[a-z0-9]+/
        }
      ]
    };
  }

  // Register the language with Highlight.js if it exists
  if (typeof window !== 'undefined' && window.hljs) {
    window.hljs.registerLanguage('gcode', defineGCode);
  }
})();