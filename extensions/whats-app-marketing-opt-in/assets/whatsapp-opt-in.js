document.querySelectorAll('.esoukk-whatsapp-opt-in form').forEach((form) => {
  if (form.dataset.enhanced === 'true') return;
  form.dataset.enhanced = 'true';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phoneInput = form.elements.phone;
    const status = form.querySelector('[role="status"]');
    const button = form.querySelector('button[type="submit"]');
    let phone = phoneInput.value.trim().replace(/[\s()-]/g, '');
    if (/^05\d{8}$/.test(phone)) phone = `+971${phone.slice(1)}`;
    if (/^9715\d{8}$/.test(phone)) phone = `+${phone}`;
    if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      status.textContent = form.dataset.phoneError;
      status.hidden = false;
      phoneInput.setAttribute('aria-invalid', 'true');
      phoneInput.focus();
      return;
    }
    phoneInput.value = phone;
    phoneInput.removeAttribute('aria-invalid');
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = form.dataset.submittingLabel;
    status.hidden = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || form.dataset.errorMessage);
      }
      status.textContent = form.dataset.successMessage;
      status.hidden = false;
      form.reset();
    } catch (error) {
      status.textContent = error.message || form.dataset.errorMessage;
      status.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
});
