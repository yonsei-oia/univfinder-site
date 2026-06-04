// Pure, dependency-free hash-route helpers for the per-school deep link.
// Shared by the browser (global HashRoute) and Node tests (module.exports).
(function (global) {
    'use strict';

    function slugFromHash(hash) {
        var s = String(hash || '').replace(/^#\/?/, ''); // strip leading '#' and optional '/'
        return s.split(/[/?#]/)[0].trim();                // first path segment only
    }

    function hashForSlug(slug) {
        return slug ? '#/' + slug : '';
    }

    var HashRoute = { slugFromHash: slugFromHash, hashForSlug: hashForSlug };
    if (typeof module !== 'undefined' && module.exports) module.exports = HashRoute;
    global.HashRoute = HashRoute;
})(typeof window !== 'undefined' ? window : globalThis);
