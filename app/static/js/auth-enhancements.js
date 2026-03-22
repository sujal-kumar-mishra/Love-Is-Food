// Auth Enhancements: password toggle, strength meter, caps-lock detection, alerts
(function() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  const passwordInput = document.getElementById('password');
  const emailInput = document.getElementById('email');
  const toggleBtn = document.getElementById('togglePassword');
  const strengthBar = document.querySelector('.password-strength-bar');
  const alertEl = document.getElementById('alert');
  const submitBtn = document.getElementById('loginBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('spinner');

  function showAlert(message, type = 'error') {
    alertEl.className = `alert alert-${type} show`;
    alertEl.innerHTML = '';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.innerHTML = type === 'success'
      ? '<use href="#check"></use>'
      : '<use href="#alert-triangle"></use>';
    alertEl.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = message;
    alertEl.appendChild(span);
    alertEl.setAttribute('role', 'alert');
    alertEl.setAttribute('aria-live', 'polite');
    setTimeout(() => { alertEl.classList.remove('show'); }, 5000);
  }

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      btnText.style.display = 'none';
      spinner.classList.add('show');
    } else {
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      spinner.classList.remove('show');
    }
  }

  // Password toggle
  toggleBtn.addEventListener('click', () => {
    const isTypePassword = passwordInput.type === 'password';
    passwordInput.type = isTypePassword ? 'text' : 'password';
    toggleBtn.setAttribute('aria-label', isTypePassword ? 'Hide password' : 'Show password');
    toggleBtn.innerHTML = `<svg width="20" height="20"><use href="#${isTypePassword ? 'eye-off' : 'eye'}"></use></svg>`;
  });

  // Caps-lock detection
  passwordInput.addEventListener('keyup', (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      passwordInput.setAttribute('aria-describedby', 'capsWarning');
    } else {
      passwordInput.removeAttribute('aria-describedby');
    }
  });

  // Strength meter (very basic heuristic)
  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    let strength = 0;
    if (val.length >= 8) strength += 25;
    if (/[A-Z]/.test(val)) strength += 25;
    if (/[0-9]/.test(val)) strength += 25;
    if (/[^A-Za-z0-9]/.test(val)) strength += 25;
    strengthBar.style.width = strength + '%';
    strengthBar.style.background = strength < 50 ? 'var(--color-error)' : strength < 75 ? 'var(--color-warning)' : 'var(--gradient-primary)';
  });

  // Inline validation for email format
  emailInput.addEventListener('blur', () => {
    const val = emailInput.value.trim();
    if (val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
      emailInput.setAttribute('aria-invalid', 'true');
      showAlert('Please enter a valid email address.', 'error');
    } else {
      emailInput.removeAttribute('aria-invalid');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      email: emailInput.value.trim(),
      password: passwordInput.value,
      remember: document.getElementById('remember')?.checked || false
    };

    if (!formData.email || !formData.password) {
      showAlert('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = data.redirect || '/'; }, 800);
      } else {
        showAlert(data.message || 'Login failed. Please try again.', 'error');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      showAlert('An error occurred. Please try again.', 'error');
      setLoading(false);
    }
  });

  // Autofocus
  emailInput.focus();
})();
