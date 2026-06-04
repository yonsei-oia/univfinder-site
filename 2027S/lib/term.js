// Pure, dependency-free term logic shared by the browser (global TermLib) and
// Node tests (module.exports). All term-dependent display derives from the
// site's single SEMESTER_CODE constant.
(function (global) {
    'use strict';

    // '27S' -> { year: 2027, season: 'spring' }; '27F' -> { year: 2027, season: 'fall' }
    function parseSemester(code) {
        const s = String(code).trim();
        const year = 2000 + parseInt(s.substring(0, 2), 10);
        const season = s.toUpperCase().endsWith('S') ? 'spring' : 'fall';
        return { year, season };
    }

    // The calendar year an active term's deadlines fall in.
    // Spring [Y] intake recruits during [Y-1]; Fall [Y] intake recruits during [Y].
    function deadlineYear(code) {
        const { year, season } = parseSemester(code);
        return season === 'spring' ? year - 1 : year;
    }

    // Step 6 pre-departure orientation date. Spring -> the November before
    // departure; Fall -> the May of the departure year. Online, rule-derived.
    function orientationLabel(code) {
        const { year, season } = parseSemester(code);
        return season === 'spring' ? `November ${year - 1}` : `May ${year}`;
    }

    // Which university object fields hold the ACTIVE term's deadlines.
    function activeDeadlineFields(code) {
        const { season } = parseSemester(code);
        return season === 'spring'
            ? { nom: 'springNominationDeadline', app: 'springApplicationDeadline' }
            : { nom: 'fallNominationDeadline', app: 'fallApplicationDeadline' };
    }

    const _MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // '10/31' + 2026 -> 'Oct 31, 2026'. Returns '' for empty / non-MM/DD / out-of-range.
    function formatDeadline(mmdd, year) {
        if (!mmdd) return '';
        const m = String(mmdd).trim().match(/^(\d{1,2})\/(\d{1,2})$/);
        if (!m) return '';
        const mo = parseInt(m[1], 10), da = parseInt(m[2], 10);
        if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
        return `${_MONTHS[mo - 1]} ${da}, ${year}`;
    }

    // Does the school offer an intake in the active term? Reads that season's
    // two option flags (booleans on u). Both false (incl. 'N' or blank) -> no.
    function offersTerm(u, code) {
        return parseSemester(code).season === 'spring'
            ? !!(u.springOneSemester || u.springCalendarYear)
            : !!(u.fallOneSemester || u.fallCalendarYear);
    }

    // Recruiting this term = offers the term AND has slots. quota is normally a
    // parsed number (0 = no slots); tolerate strings so callers cannot break.
    function isRecruiting(u, code) {
        const q = typeof u.quota === 'number' ? u.quota : parseFloat(u.quota);
        return offersTerm(u, code) && !isNaN(q) && q > 0;
    }

    const TermLib = { parseSemester, deadlineYear, orientationLabel,
                      activeDeadlineFields, formatDeadline, offersTerm, isRecruiting };

    if (typeof module !== 'undefined' && module.exports) module.exports = TermLib;
    global.TermLib = TermLib;
})(typeof window !== 'undefined' ? window : globalThis);
