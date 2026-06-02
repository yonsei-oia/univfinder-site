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

    const TermLib = { parseSemester, deadlineYear, orientationLabel, activeDeadlineFields };

    if (typeof module !== 'undefined' && module.exports) module.exports = TermLib;
    global.TermLib = TermLib;
})(typeof window !== 'undefined' ? window : globalThis);
