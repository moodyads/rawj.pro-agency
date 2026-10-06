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
});
