/**
 * Student Subscription Checkout Engine
 * Manages recurring $10/month self-study subscription checkout via Stripe.
 */

(function () {
  'use strict';

  const API_BASE = 'https://ca-api-dev.ambitiouswave-1e406ff3.centralus.azurecontainerapps.io';

  const form = document.getElementById('student-checkout-form');
  const emailInput = document.getElementById('student-email');
  const emailHelper = document.getElementById('student-email-helper');
  const alertBox = document.getElementById('student-alert');
  const btnPay = document.getElementById('btn-student-pay');
  const btnText = document.getElementById('btn-student-text');
  const btnSpinner = document.getElementById('btn-student-spinner');

  // Read query params from mobile handoff
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');
  const tokenParam = urlParams.get('token');

  if (emailParam) {
    emailInput.value = emailParam.trim().toLowerCase();
    if (tokenParam) {
      emailInput.readOnly = true;
      emailInput.classList.add('is-verified');
      emailHelper.textContent = '✓ Verified student account from mobile app.';
      emailHelper.style.color = '#047857';
    }
  }

  function showAlert(msg, type = 'error') {
    alertBox.className = `alert-box is-${type}`;
    alertBox.innerHTML = msg;
    alertBox.style.display = 'block';
  }

  function hideAlert() {
    alertBox.style.display = 'none';
    alertBox.textContent = '';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      showAlert('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    btnPay.disabled = true;
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = 'Redirecting to Stripe Billing...';

    const payload = {
      plan_id: 'student_monthly',
      email: email,
      verification_token: tokenParam || null,
      success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&role=student`,
      cancel_url: `${window.location.origin}/payment-cancelled?role=student`,
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions/public/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to initialize subscription checkout.');
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received from server.');
      }
    } catch (err) {
      showAlert(`Checkout initialization failed: ${err.message}`);
      btnPay.disabled = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Proceed to Stripe Payment ($10/mo)';
    }
  });
})();
