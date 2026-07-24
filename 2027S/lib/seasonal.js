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
            out.push('Settlement grant (정착지원금): ' + formatWon(program.scholarship_settlement));
        }
        if (program && program.scholarship_tuition) {
            out.push('Tuition subsidy (등록금지원금): ' + program.scholarship_tuition);
        }
        return out;
    }

    var _SEASONAL_FIELD_LABELS = {
        quota: 'Quota', quota_unit: 'Quota unit',
        application_deadline: 'Application deadline', nomination_deadline: 'Nomination deadline',
        program_dates: 'Program dates', program_type: 'Program type',
        summer_open: 'Summer availability', winter_open: 'Winter availability',
        gpa_required: 'GPA Required', toefl_total: 'TOEFL iBT', toefl_subscores: 'TOEFL subscores',
        lang2_level: 'Language level',
        accepts_undergrad: 'Open to Undergraduate', accepts_grad: 'Open to Graduate',
        available_areas: 'Available areas', restricted_areas: 'Restricted areas',
        scholarship_settlement: 'Settlement grant', scholarship_tuition: 'Tuition subsidy',
        program_fees: 'Fees',
    };
    function seasonalFieldLabel(field) {
        return _SEASONAL_FIELD_LABELS[field] || String(field);
    }
    function _seasonalValueFmt(field, v) {
        if (v === null || v === undefined || v === '') return '—';
        if (v === true) return 'Yes';
        if (v === false) return 'No';
        if (field === 'scholarship_settlement' && typeof v === 'number') return formatWon(v);
        return String(v);
    }
    // One update-history entry -> array of human-readable change lines.
    // program_fees deliberately has no from/to (stripped in the backend feed).
    function seasonalDescribeEntry(entry) {
        if (!entry) return [];
        if (entry.kind === 'added') return ['New program'];
        return (entry.changes || []).map(function (c) {
            if (c.field === 'program_fees') return 'Fees updated';
            return seasonalFieldLabel(c.field) + ': ' +
                _seasonalValueFmt(c.field, c.from) + ' → ' + _seasonalValueFmt(c.field, c.to);
        });
    }

    var SeasonalLib = { isSeasonalPath, programTypeLabel, formatWon, scholarshipLines,
                        seasonalFieldLabel, seasonalDescribeEntry };
    if (typeof module !== 'undefined' && module.exports) module.exports = SeasonalLib;
    global.SeasonalLib = SeasonalLib;
})(typeof window !== 'undefined' ? window : globalThis);
