// Pure, dependency-free campus-map embed URL builder. Shared by the browser
// (global CampusMap) and Node tests (module.exports). Keyless Google Maps embed.
(function (global) {
    'use strict';

    function src(name, country, override) {
        if (override) {
            // Already an embeddable URL -> use directly; else wrap as a q= embed.
            if (/output=embed|\/maps\/embed/.test(override)) return override;
            return 'https://maps.google.com/maps?q=' + encodeURIComponent(override) + '&output=embed';
        }
        var q = country ? (name + ', ' + country) : name;
        return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed&z=14';
    }

    var CampusMap = { src: src };
    if (typeof module !== 'undefined' && module.exports) module.exports = CampusMap;
    global.CampusMap = CampusMap;
})(typeof window !== 'undefined' ? window : globalThis);
