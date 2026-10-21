document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('.faq-question').forEach(function (button) {
    button.addEventListener('click', function () {
      var item = button.closest('.faq-item');
      var open = item.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  document.querySelectorAll('.lead-form').forEach(function (form) {
    var submitted = false;
    var frame = document.getElementById(form.getAttribute('data-frame'));
    var success = form.querySelector('.form-success');

    form.addEventListener('submit', function (event) {
      var valid = true;
      var name = form.querySelector('[data-name]');
      var phone = form.querySelector('[data-phone]');
      var country = form.querySelector('[data-country]');
      var digits = phone.value.replace(/\D/g, '');

      form.querySelectorAll('.field-error').forEach(function (error) { error.style.display = 'none'; });
      if (name.value.trim().length < 2) {
        name.closest('.field').querySelector('.field-error').style.display = 'block';
        valid = false;
      }
      if (digits.length < 8 || digits.length > 15) {
        phone.closest('.field').querySelector('.field-error').style.display = 'block';
        valid = false;
      }
      if (!country.value) {
        country.closest('.field').querySelector('.field-error').style.display = 'block';
        valid = false;
      }
      if (!valid) {
        event.preventDefault();
        return;
      }
      submitted = true;
    });

    if (frame) {
      frame.addEventListener('load', function () {
        if (!submitted) return;
        form.reset();
        if (success) success.style.display = 'block';
        submitted = false;
      });
    }
  });

  document.querySelectorAll('.checkout-form').forEach(function (form) {
    var submitted = false;
    var frame = document.getElementById(form.getAttribute('data-frame'));
    var success = form.querySelector('.form-success');
    var submitButton = form.querySelector('.checkout-submit');
    var originalButtonText = submitButton ? submitButton.textContent : '';

    function setFieldState(field, valid) {
      var wrapper = field.closest('.checkout-field');
      var error = wrapper ? wrapper.querySelector('.field-error') : null;
      field.setAttribute('aria-invalid', String(!valid));
      if (error) error.style.display = valid ? 'none' : 'block';
      return valid;
    }

    form.addEventListener('submit', function (event) {
      var firstName = form.querySelector('[data-checkout-first-name]');
      var lastName = form.querySelector('[data-checkout-last-name]');
      var email = form.querySelector('[data-checkout-email]');
      var phone = form.querySelector('[data-checkout-phone]');
      var consent = form.querySelector('#policy-consent');
      var consentError = form.querySelector('.consent-error');
      var digits = phone.value.replace(/\D/g, '');
      var valid = true;

      if (success) success.style.display = 'none';
      valid = setFieldState(firstName, firstName.value.trim().length >= 2) && valid;
      valid = setFieldState(lastName, lastName.value.trim().length >= 2) && valid;
      valid = setFieldState(email, email.value.trim() !== '' && email.validity.valid) && valid;
      valid = setFieldState(phone, digits.length >= 8 && digits.length <= 15) && valid;

      if (consentError) consentError.style.display = consent.checked ? 'none' : 'block';
      consent.setAttribute('aria-invalid', String(!consent.checked));
      valid = consent.checked && valid;

      if (!valid) {
        event.preventDefault();
        var firstInvalid = form.querySelector('[aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      submitted = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'جارٍ تأكيد الطلب...';
      }
    });

    if (frame) {
      frame.addEventListener('load', function () {
        if (!submitted) return;
        form.reset();
        form.querySelectorAll('[aria-invalid]').forEach(function (field) { field.removeAttribute('aria-invalid'); });
        if (success) success.style.display = 'block';
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
        submitted = false;
      });
    }
  });
});
