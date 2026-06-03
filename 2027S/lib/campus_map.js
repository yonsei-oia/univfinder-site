// Pure, dependency-free OpenStreetMap embed URL builder. Shared by the browser
// (global CampusMap) and Node tests (module.exports). Keyless OSM embed from
// coordinates (lat, lng) — reliable because no client-side geocoding is needed.
(function (global) {
    'use strict';

    function osmSrc(lat, lng) {
        if (lat == null || lng == null) return '';
        var d = 0.008; // ~campus-area view
        var bbox = (lng - d).toFixed(5) + ',' + (lat - d).toFixed(5) + ','
                 + (lng + d).toFixed(5) + ',' + (lat + d).toFixed(5);
        return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox
             + '&layer=mapnik&marker=' + lat + ',' + lng;
    }

    var CampusMap = { osmSrc: osmSrc };
    if (typeof module !== 'undefined' && module.exports) module.exports = CampusMap;
    global.CampusMap = CampusMap;
})(typeof window !== 'undefined' ? window : globalThis);
