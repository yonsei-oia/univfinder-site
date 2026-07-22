// Pure, dependency-free seasonal helpers. Shared by browser (SeasonalLib) and
// Node tests. All student-facing copy is English; scholarship glosses the
// Korean term in parentheses (Outbound students are Yonsei students).
(function (global) {
    'use strict';

    function isSeasonalPath(pathname) {
        return /^\/seasonal(\/|$)/.test(String(pathname || ''));
    }

    function programTypeLabel(type) {
        if (String(type).toUpperCase() === 'VSP') {
            return { short: 'VSP', full: 'Visiting (VSP) — tuition applies' };
        }
        return { short: 'ESP', full: 'Exchange (ESP) — no tuition' };
    }

    function formatWon(n) {
        if (n == null || isNaN(n)) return '';
        return 'KRW ' + Number(n).toLocaleString('en-US');
    }

    function scholarshipLines(program) {
        var out = [];
        if (program && program.scholarship_settlement != null) {
            out.push('Settlement grant: ' + formatWon(program.scholarship_settlement) + ' (정착지원금)');
        }
        if (program && program.scholarship_tuition) {
            out.push('Tuition subsidy: ' + program.scholarship_tuition + ' (등록금지원금)');
        }
        return out;
    }

    var SeasonalLib = { isSeasonalPath, programTypeLabel, formatWon, scholarshipLines };
    if (typeof module !== 'undefined' && module.exports) module.exports = SeasonalLib;
    global.SeasonalLib = SeasonalLib;
})(typeof window !== 'undefined' ? window : globalThis);
