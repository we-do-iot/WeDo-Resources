/* ==========================================================
 * WeDo Tank v3 — JavaScript helpers
 * --------------------------------------------------------
 * Repo: https://github.com/<usuario>/wedo-widgets
 * CDN:  https://cdn.jsdelivr.net/gh/<usuario>/wedo-widgets@<ver>/tank/tank.js
 *
 * Responsabilidades:
 *   1. ResizeObserver para ajustar densidad de marcas menores
 *      según el alto disponible (lo que CSS solo no puede hacer)
 *   2. Helper para construir marcas mayores y menores
 *      respetando el rango (CSS recibe solo posiciones bottom%)
 *   3. Helper para detectar transición cono-cilindro (26%)
 *
 * Uso desde el widget de ThingsBoard:
 *   window.WedoTank.attachResizeObserver(scaleEl)
 *   window.WedoTank.buildTicks(max, baseStep, isCone) -> { major:[], minor:[] }
 * ========================================================== */

(function (global) {
    'use strict';

    var WedoTank = {};

    /**
     * Calcula un step "lindo" (1, 2, 5, 10, 20, 50, 100...) para la escala
     */
    WedoTank.calcNiceStep = function (maxVal, targetDivisions) {
        if (!maxVal || maxVal <= 0) return 10;
        var rawStep = maxVal / (targetDivisions || 5);
        var magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        var residual = rawStep / magnitude;
        var niceStep;
        if (residual <= 1.5) niceStep = 1;
        else if (residual <= 3.5) niceStep = 2;
        else if (residual <= 7.5) niceStep = 5;
        else niceStep = 10;
        return niceStep * magnitude;
    };

    /**
     * Step adaptivo: si el alto disponible no alcanza, agranda el step
     */
    WedoTank.calcAdaptiveStep = function (baseStep, max, availableHeight, minPxPerTick) {
        minPxPerTick = minPxPerTick || 14;
        var totalTicks = Math.floor(max / baseStep) + 1;
        if (availableHeight <= 0 || totalTicks <= 2) return baseStep;

        var pxPerTick = availableHeight / (totalTicks - 1);
        var multiplier = 1;
        while (pxPerTick < minPxPerTick && multiplier < 32) {
            multiplier *= 2;
            var reduced = Math.floor(max / (baseStep * multiplier)) + 1;
            if (reduced <= 2) break;
            pxPerTick = availableHeight / (reduced - 1);
        }
        return baseStep * multiplier;
    };

    /**
     * Formatea un valor numérico para mostrar como label de escala
     */
    WedoTank.formatTickLabel = function (value, max, unit) {
        var label;
        if (max >= 1000) {
            label = Math.round(value);
        } else if (max >= 10) {
            label = Math.round(value * 10) / 10;
        } else {
            label = Math.round(value * 100) / 100;
        }
        return unit ? (label + unit) : String(label);
    };

    /**
     * Construye las marcas mayores y menores
     * @param {Object} opts
     * @param {number} opts.max          Valor máximo de la escala
     * @param {number} opts.majorStep    Paso para marcas mayores
     * @param {number} opts.minorStep    Paso para marcas menores (opcional)
     * @param {boolean} opts.isCone      Si es cono, agrega marca CONO en 26%
     * @param {string} opts.unit         Sufijo de unidad (opcional)
     * @returns {Object} { major: [{pct, label}], minor: [{pct}], coneMarker: {pct, label}|null }
     */
    WedoTank.buildTicks = function (opts) {
        var max = opts.max || 100;
        var majorStep = opts.majorStep || (max / 4);
        var minorStep = opts.minorStep || (majorStep / 5);
        var unit = opts.unit || '';

        var major = [];
        for (var i = 0; i <= max + 0.0001; i += majorStep) {
            var pct = (i / max) * 100;
            if (pct > 100.0001) break;
            major.push({
                pct: pct,
                label: WedoTank.formatTickLabel(i, max, unit)
            });
        }

        var minor = [];
        if (minorStep > 0 && minorStep < majorStep) {
            for (var j = minorStep; j < max; j += minorStep) {
                var pctM = (j / max) * 100;
                // Saltar si coincide con una mayor
                var matchesMajor = false;
                for (var k = 0; k < major.length; k++) {
                    if (Math.abs(major[k].pct - pctM) < 0.5) { matchesMajor = true; break; }
                }
                if (!matchesMajor) {
                    minor.push({ pct: pctM });
                }
            }
        }

        var coneMarker = null;
        if (opts.isCone) {
            // 26% de altura visual = donde empieza el cilindro
            coneMarker = { pct: 26, label: 'CONO' };
        }

        return { major: major, minor: minor, coneMarker: coneMarker };
    };

    /**
     * Adjunta un ResizeObserver al elemento de la escala
     * Ajusta clases de densidad según el alto disponible
     * @param {HTMLElement} scaleEl  El elemento .tank-scale
     * @returns {ResizeObserver}     Para poder hacer disconnect después
     */
    WedoTank.attachResizeObserver = function (scaleEl) {
        if (!scaleEl || typeof ResizeObserver === 'undefined') return null;

        var ro = new ResizeObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                var h = entry.contentRect.height;
                var w = entry.contentRect.width;
                // En horizontal usamos width para densidad, en vertical height
                var ref = scaleEl.classList.contains('tank-scale--horizontal') ? w : h;

                scaleEl.classList.remove('density-low', 'density-very-low');
                if (ref < 120) {
                    scaleEl.classList.add('density-very-low');
                } else if (ref < 200) {
                    scaleEl.classList.add('density-low');
                }
            }
        });

        ro.observe(scaleEl);
        return ro;
    };

    /**
     * Formatea un volumen para display final (con miles separados por punto)
     */
    WedoTank.formatVolume = function (value, decimals) {
        if (value == null || isNaN(value)) return '-';
        decimals = (typeof decimals !== 'undefined') ? decimals : 0;
        var fixed = parseFloat(value).toFixed(decimals);
        // Separador de miles con punto (formato AR)
        var parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return parts.join(',');
    };

    /* Exportar al namespace global */
    global.WedoTank = WedoTank;

})(window);
