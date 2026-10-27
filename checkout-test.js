(function () {
    'use strict';

    const panel = document.querySelector('.paymob-test-result');
    const status = document.getElementById('paymob-test-status');
    const details = document.getElementById('paymob-test-details');
    const refresh = document.getElementById('refresh-test-result');

    if (!panel || !status || !details) return;

    async function loadResult() {
        status.hidden = false;
        status.textContent = 'جارٍ تحميل نتيجة الاختبار من Paymob…';
        details.hidden = true;
        panel.classList.remove('is-success');
        if (refresh) refresh.disabled = true;

        try {
            const response = await fetch(`/paymob-test-result.json?ts=${Date.now()}`, {
                cache: 'no-store',
                credentials: 'omit'
            });
            if (!response.ok) throw new Error('Test result is not available');
            const result = await response.json();
            if (!result || typeof result !== 'object') throw new Error('Invalid test result');

            document.getElementById('test-amount').textContent = `${result.amount || 200} ${result.currency || 'USD'}`;
            document.getElementById('test-mode').textContent = result.mode || 'Test';
            document.getElementById('test-time').textContent = result.testedAt || '—';
            document.getElementById('test-error').textContent = result.message || 'No response recorded';
            status.textContent = !result.testedAt
                ? 'لم يتم تشغيل اختبار Paymob بعد. لا توجد أي عملية دفع حقيقية.'
                : result.ok
                    ? 'نجح Paymob في إنشاء محاولة الدفع التجريبية.'
                    : 'تم إرسال محاولة الدفع التجريبية، وأعاد Paymob الخطأ الموضح أدناه.';
            panel.classList.toggle('is-success', Boolean(result.ok));
            details.hidden = false;
        } catch (_) {
            status.textContent = 'لم يتم تشغيل اختبار Paymob بعد. لا توجد أي عملية دفع حقيقية.';
        } finally {
            if (refresh) refresh.disabled = false;
        }
    }

    refresh?.addEventListener('click', loadResult);
    loadResult();
}());
