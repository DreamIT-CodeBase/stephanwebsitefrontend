/**
 * Admin Subscription & Verification Engine
 * Handles form validation, email OTP verification, plan selection,
 * and Stripe hosted checkout session creation.
 */

(function () {
  'use strict';

  const API_BASE = 'https://ca-api-dev.ambitiouswave-1e406ff3.centralus.azurecontainerapps.io';

  // State
  let isEmailVerified = false;
  let verificationToken = null;
  let currentTargetEmail = '';
  let timerInterval = null;
  let resendInterval = null;
  let countdownSeconds = 600; // 10 minutes

  // DOM Elements
  const form = document.getElementById('admin-subscribe-form');
  const nameInput = document.getElementById('admin-name');
  const orgInput = document.getElementById('admin-org');
  const emailInput = document.getElementById('admin-email');
  const phoneInput = document.getElementById('admin-phone');
  const emailVerifiedBadge = document.getElementById('email-verified-badge');
  const emailHelper = document.getElementById('email-helper');
  const formAlert = document.getElementById('form-alert');
  const btnSubmit = document.getElementById('btn-submit-action');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');

  const step1 = document.getElementById('step-nav-1');
  const step2 = document.getElementById('step-nav-2');
  const step3 = document.getElementById('step-nav-3');

  // Modal Elements
  const otpModal = document.getElementById('otp-modal');
  const modalTargetEmail = document.getElementById('modal-target-email');
  const modalAlert = document.getElementById('modal-alert');
  const otpDigits = document.querySelectorAll('.otp-digit');
  const countdownTimer = document.getElementById('countdown-timer');
  const btnVerifyOtp = document.getElementById('btn-verify-otp');
  const btnVerifyText = document.getElementById('btn-verify-text');
  const btnVerifySpinner = document.getElementById('btn-verify-spinner');
  const btnResendOtp = document.getElementById('btn-resend-otp');
  const resendCooldown = document.getElementById('resend-cooldown');

  // Plan Cards
  const planCards = document.querySelectorAll('.plan-card');
  const planRadios = document.querySelectorAll('input[name="plan"]');

  // Plan Prices mapping
  const PLAN_PRICES = {
    monthly: '$19 / month',
    annual: '$190 / year',
    pro: '$29 / month',
  };

  // Pre-fill email or params from query string if present (e.g. from app handoff)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('email')) {
    emailInput.value = urlParams.get('email');
  }
  if (urlParams.get('plan') && ['monthly', 'annual', 'pro'].includes(urlParams.get('plan'))) {
    const targetRadio = document.getElementById('plan-' + urlParams.get('plan'));
    if (targetRadio) targetRadio.checked = true;
  }

  // Handle Plan Card Selection UI
  function updatePlanSelection() {
    planCards.forEach((card) => {
      const radio = card.querySelector('.plan-radio');
      if (radio && radio.checked) {
        card.classList.add('is-selected');
      } else {
        card.classList.remove('is-selected');
      }
    });
    updateButtonText();
  }

  planRadios.forEach((radio) => {
    radio.addEventListener('change', updatePlanSelection);
  });
  updatePlanSelection();

  function getSelectedPlan() {
    const checked = document.querySelector('input[name="plan"]:checked');
    return checked ? checked.value : 'monthly';
  }

  function updateButtonText() {
    if (isEmailVerified) {
      const plan = getSelectedPlan();
      btnText.textContent = `Proceed to Stripe Payment (${PLAN_PRICES[plan] || '$19'})`;
    } else {
      btnText.textContent = 'Verify Email & Continue';
    }
  }

  // Alerts
  function showAlert(el, msg, type = 'error') {
    el.className = `alert-box is-${type}`;
    el.innerHTML = msg;
    el.style.display = 'block';
  }

  function hideAlert(el) {
    el.style.display = 'none';
    el.textContent = '';
  }

  // Form Validation
  function validateForm() {
    hideAlert(formAlert);
    const name = nameInput.value.trim();
    const org = orgInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const phone = phoneInput.value.trim();

    if (!name || name.length < 2) {
      showAlert(formAlert, 'Please enter your full administrator name.');
      nameInput.focus();
      return false;
    }
    if (!org || org.length < 2) {
      showAlert(formAlert, 'Please enter your school or organization name.');
      orgInput.focus();
      return false;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      showAlert(formAlert, 'Please enter a valid administrator email address.');
      emailInput.focus();
      return false;
    }
    const cleanPhone = phone.replace(/[\s\(\)\-\+]/g, '');
    if (!phone || cleanPhone.length < 7) {
      showAlert(formAlert, 'Please enter a valid telephone number with country/area code.');
      phoneInput.focus();
      return false;
    }
    return true;
  }

  // Form Submit Handler
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isEmailVerified) {
      await initiateEmailVerification();
    } else {
      await initiateStripeCheckout();
    }
  });

  // Step 2: Send OTP
  async function initiateEmailVerification() {
    const email = emailInput.value.trim().toLowerCase();
    currentTargetEmail = email;

    btnSubmit.disabled = true;
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = 'Sending Verification Code...';

    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to send verification code.');
      }

      // Open OTP Modal
      openOtpModal(email);
    } catch (err) {
      showAlert(formAlert, `Verification error: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSpinner.style.display = 'none';
      updateButtonText();
    }
  }

  // OTP Modal Logic
  function openOtpModal(email) {
    modalTargetEmail.textContent = email;
    hideAlert(modalAlert);
    otpModal.classList.add('is-open');
    step1.classList.remove('active');
    step1.classList.add('completed');
    step2.classList.add('active');

    // Reset OTP digits
    otpDigits.forEach((d) => (d.value = ''));
    setTimeout(() => otpDigits[0].focus(), 150);

    startOtpTimer();
    startResendCooldown();
  }

  function closeOtpModal() {
    otpModal.classList.remove('is-open');
    clearInterval(timerInterval);
    clearInterval(resendInterval);
  }

  function startOtpTimer() {
    clearInterval(timerInterval);
    countdownSeconds = 600;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      countdownSeconds--;
      if (countdownSeconds <= 0) {
        clearInterval(timerInterval);
        showAlert(modalAlert, 'Verification code has expired. Please request a new code.');
        btnVerifyOtp.disabled = true;
      }
      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(countdownSeconds / 60);
    const secs = countdownSeconds % 60;
    countdownTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function startResendCooldown() {
    clearInterval(resendInterval);
    let cooldown = 30;
    btnResendOtp.disabled = true;
    resendCooldown.textContent = cooldown;

    resendInterval = setInterval(() => {
      cooldown--;
      if (cooldown <= 0) {
        clearInterval(resendInterval);
        btnResendOtp.disabled = false;
        btnResendOtp.textContent = 'Resend verification code';
      } else {
        resendCooldown.textContent = cooldown;
      }
    }, 1000);
  }

  // Resend OTP
  btnResendOtp.addEventListener('click', async function () {
    if (btnResendOtp.disabled) return;
    btnResendOtp.disabled = true;
    btnResendOtp.textContent = 'Sending new code...';
    hideAlert(modalAlert);

    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentTargetEmail }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to resend code.');
      }

      showAlert(modalAlert, 'New 6-digit code has been emailed to you!', 'success');
      startOtpTimer();
      startResendCooldown();
      otpDigits.forEach((d) => (d.value = ''));
      otpDigits[0].focus();
    } catch (err) {
      showAlert(modalAlert, err.message);
      btnResendOtp.disabled = false;
      btnResendOtp.textContent = 'Resend verification code';
    }
  });

  // OTP Digits Auto-tabbing & Paste Handler
  otpDigits.forEach((digit, index) => {
    digit.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length === 1 && index < otpDigits.length - 1) {
        otpDigits[index + 1].focus();
      }
    });

    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpDigits[index - 1].focus();
      }
    });

    digit.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(paste)) {
        paste.split('').forEach((char, i) => {
          if (otpDigits[i]) otpDigits[i].value = char;
        });
        otpDigits[5].focus();
        document.getElementById('otp-form').dispatchEvent(new Event('submit'));
      }
    });
  });

  // Verify OTP Form Submit
  document.getElementById('otp-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert(modalAlert);

    let enteredOtp = '';
    otpDigits.forEach((d) => (enteredOtp += d.value.trim()));

    if (enteredOtp.length !== 6 || !/^\d{6}$/.test(enteredOtp)) {
      showAlert(modalAlert, 'Please enter the complete 6-digit numeric code.');
      return;
    }

    btnVerifyOtp.disabled = true;
    btnVerifySpinner.style.display = 'inline-block';
    btnVerifyText.textContent = 'Verifying Code...';

    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentTargetEmail, otp: enteredOtp }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Incorrect or expired verification code.');
      }

      // Success
      verificationToken = data.verification_token;
      isEmailVerified = true;

      // Update UI
      emailInput.readOnly = true;
      emailInput.classList.add('is-verified');
      emailVerifiedBadge.style.display = 'inline-block';
      emailHelper.textContent = '✓ Administrator email successfully verified.';
      emailHelper.style.color = '#15803d';

      step2.classList.remove('active');
      step2.classList.add('completed');
      step3.classList.add('active');

      closeOtpModal();
      updateButtonText();
      showAlert(formAlert, '✓ Email verified! Click below to proceed to secure Stripe checkout.', 'success');

      // Auto-trigger checkout step smoothly
      setTimeout(() => {
        initiateStripeCheckout();
      }, 500);
    } catch (err) {
      showAlert(modalAlert, err.message);
    } finally {
      btnVerifyOtp.disabled = false;
      btnVerifySpinner.style.display = 'none';
      btnVerifyText.textContent = 'Confirm & Proceed';
    }
  });

  // Step 4: Stripe Checkout Session Creation
  async function initiateStripeCheckout() {
    btnSubmit.disabled = true;
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = 'Redirecting to Stripe Billing...';

    const selectedPlan = getSelectedPlan();
    const payload = {
      plan_id: selectedPlan,
      email: currentTargetEmail || emailInput.value.trim().toLowerCase(),
      full_name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      organization: orgInput.value.trim(),
      verification_token: verificationToken,
      success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&role=admin`,
      cancel_url: `${window.location.origin}/payment-cancelled?role=admin`,
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/public/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to start Stripe checkout session.');
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL returned from server.');
      }
    } catch (err) {
      showAlert(formAlert, `Checkout creation error: ${err.message}`);
      btnSubmit.disabled = false;
      btnSpinner.style.display = 'none';
      updateButtonText();
    }
  }
})();
