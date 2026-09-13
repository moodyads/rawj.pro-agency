(async function () {
    'use strict';
    const elements = document.querySelectorAll('[data-eg-only]');
    const status = document.getElementById('region-status');
    if (!elements.length) return;
    elements.forEach(element => { element.hidden = true; });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        // This controls visibility, not payment authorization. Fail closed.
        const response = await fetch('https://api.country.is/', {
            signal: controller.signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Country lookup failed');
        const location = await response.json();
        if (location.error || !/^[A-Z]{2}$/.test(location.country || '')) {
            throw new Error('Invalid country response');
        }
        const isEgypt = location.country === 'EG';
        elements.forEach(element => { element.hidden = !isEgypt; });
        if (status) {
            status.hidden = isEgypt;
            status.textContent = isEgypt ? '' : 'هذه الصفحة متاحة للعملاء المتصلين من مصر فقط. للاستفسارات، يرجى التواصل معنا.';
        }
    } catch (_) {
        if (status) status.textContent = 'تعذر تحديد بلد الاتصال. يرجى المحاولة لاحقًا أو التواصل معنا.';
    } finally {
        clearTimeout(timeout);
    }
}());
