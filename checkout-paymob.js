(function () {
  'use strict';

  document.querySelectorAll('.checkout-form[data-paymob-endpoint]').forEach(function (form) {
    var submitButton = form.querySelector('.checkout-submit');
    var errorBox = form.querySelector('.checkout-payment-error');
    var errorMessage = errorBox.querySelector('code');
    var originalButtonText = submitButton.textContent;

    function showError(message) {
      errorMessage.textContent = message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      errorBox.hidden = true;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'جارٍ الانتقال إلى الدفع...';

      try {
        var response = await fetch(form.dataset.paymobEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: form.querySelector('[data-checkout-first-name]').value.trim(),
            lastName: form.querySelector('[data-checkout-last-name]').value.trim(),
            email: form.querySelector('[data-checkout-email]').value.trim(),
            phone: form.querySelector('[data-checkout-phone]').value.trim()
          })
        });
        var payload = await response.json().catch(function () { return {}; });

        if (response.ok && payload.checkoutUrl) {
          window.location.assign(payload.checkoutUrl);
          return;
        }

        var detail = payload.paymob || payload.error || payload.detail || payload;
        var text = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
        showError('Paymob API error (' + response.status + '): ' + text);
      } catch (error) {
        showError('تعذر الاتصال ببوابة الدفع. يرجى المحاولة مرة أخرى.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });
  });
})();
