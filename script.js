import {
  registerUser,
  saveStudentInfo,
  saveTeacherInfo,
  adminLogin,
  userLogin,
  initializeDefaultAccounts,
  sendPasswordReset
} from "./db.js";

const container = document.getElementById("container");
const signUpBtn = document.getElementById("signUpBtn");
const signInBtn = document.getElementById("signInBtn");
const googleSignUpBtn = document.getElementById("googleSignUpBtn");
const rightPanel = document.querySelector(".right-panel");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const additionalInfoForm = document.getElementById("additionalInfoForm");
const signUpContainer = document.getElementById("signUpContainer");
const additionalInfoContainer = document.getElementById("additionalInfoContainer");
const loadingIndicator = document.getElementById("loadingIndicator");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const backToSignInBtn = document.getElementById("backToSignInBtn");
const signInContainer = document.getElementById("signInContainer");
const forgotPasswordContainer = document.getElementById("forgotPasswordContainer");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");

let lastResetSentTime = {};
const RESET_COOLDOWN_MS = 5 * 60 * 1000;

const notification = {
  element: null,
  messageEl: null,
  closeBtn: null,
  timeout: null,

  init: function () {
    if (!document.querySelector('.notification-container')) {
      const container = document.createElement('div');
      container.className = 'notification-container';

      const notifEl = document.createElement('div');
      notifEl.className = 'notification';

      const messageEl = document.createElement('span');
      messageEl.className = 'notification-message';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '&times;';

      notifEl.appendChild(messageEl);
      notifEl.appendChild(closeBtn);
      container.appendChild(notifEl);
      document.body.appendChild(container);
    }

    this.element = document.querySelector('.notification');
    this.messageEl = document.querySelector('.notification-message');
    this.closeBtn = document.querySelector('.close-btn');

    this.closeBtn.addEventListener('click', () => {
      this.hide();
    });
  },

  show: function (message, type = 'info', duration = 5000) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.messageEl.textContent = message;

    this.element.classList.remove('info', 'success', 'warning', 'error');

    this.element.classList.add(type);

    this.element.classList.add('active');

    if (duration > 0) {
      this.timeout = setTimeout(() => {
        this.hide();
      }, duration);
    }
  },

  hide: function () {
    this.element.classList.remove('active');

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
};

function handleUIEvents() {
  signUpBtn.addEventListener("click", () => {
    toggleAuthView(true);
    resetSignInForm();
  });

  signInBtn.addEventListener("click", () => {
    toggleAuthView(false);
    resetSignUpForm();
  });

  signInForm.addEventListener("submit", (event) => handleFormSubmission(event, "signIn"));
  signUpForm.addEventListener("submit", (event) => handleFormSubmission(event, "signUp"));
  additionalInfoForm.addEventListener("submit", (event) => handleFormSubmission(event, "additionalInfo"));

  if (googleSignUpBtn) {
    googleSignUpBtn.addEventListener("click", handleGoogleSignIn);
  }

  forgotPasswordLink.addEventListener("click", (event) => {
    event.preventDefault();
    showForgotPasswordForm();
  });

  backToSignInBtn.addEventListener("click", (event) => {
    event.preventDefault();
    showSignInForm();
    resetForgotPasswordForm();
  });

  forgotPasswordForm.addEventListener("submit", (event) => handleFormSubmission(event, "forgotPassword"));

  const resetCompletedBtn = document.getElementById("reset-completed-btn");
  if (resetCompletedBtn) {
    resetCompletedBtn.addEventListener("click", handlePasswordResetComplete);
  }

  const resendResetBtn = document.getElementById("resend-reset-btn");
  if (resendResetBtn) {
    resendResetBtn.addEventListener("click", handleResendPasswordReset);
  }

  window.addEventListener("resize", handleResponsiveUI);
  handleResponsiveUI();
}

function showForgotPasswordForm() {
  signInContainer.style.display = "none";
  forgotPasswordContainer.style.display = "block";

  resetForgotPasswordForm();
}

function resetForgotPasswordForm() {
  if (forgotPasswordForm) {
    forgotPasswordForm.reset();
    forgotPasswordForm.style.display = "block";
  }

  const resetInstructions = document.getElementById("reset-instructions");
  if (resetInstructions) {
    resetInstructions.style.display = "none";
  }

  const resetCompletion = document.getElementById("reset-completion");
  if (resetCompletion) {
    resetCompletion.style.display = "none";
  }
}

function showSignInForm() {
  forgotPasswordContainer.style.display = "none";
  signInContainer.style.display = "block";
}

function resetSignInForm() {
  if (signInForm) {
    signInForm.reset();
  }
}

function resetSignUpForm() {
  if (signUpForm) {
    signUpForm.reset();
  }
}

function toggleAuthView(isSignUp) {
  container.classList.toggle("right-panel-active", isSignUp);
  rightPanel.style.transform = isSignUp ? "translateX(-100%)" : "translateX(0)";

  if (!isSignUp) {
    showSignInForm();
  }
}

function handleResponsiveUI() {
  if (window.innerWidth <= 768) {
    container.classList.add("mobile-view");
    rightPanel.style.transform = container.classList.contains("right-panel-active")
      ? "translateX(-100%)"
      : "translateX(100%)";
  } else {
    container.classList.remove("mobile-view");
    rightPanel.style.transform = container.classList.contains("right-panel-active")
      ? "translateX(-100%)"
      : "translateX(0)";
  }
}

function showAdditionalInfoForm(userId) {
  // Always get the selected userType and store it as lowercase
  const userTypeInput = document.querySelector('input[name="userType"]:checked');
  let userType = userTypeInput ? userTypeInput.value.trim().toLowerCase() : "";
  localStorage.setItem("pendingUserId", userId);
  localStorage.setItem("pendingUserType", userType);

  signUpContainer.classList.add("fade-out");

  setTimeout(() => {
    signUpContainer.style.display = "none";
    additionalInfoContainer.style.display = "block";
    additionalInfoContainer.classList.add("fade-in");

    updateAdditionalFormFields(userType);

    if (window.innerWidth <= 768) {
      additionalInfoContainer.scrollIntoView({ behavior: "smooth" });
    }
  }, 500);
}

function updateAdditionalFormFields(userType) {
  const additionalInfoFormContent = document.getElementById("additionalInfoForm");

  if (userType === "teacher") {
    additionalInfoFormContent.innerHTML = `
      <label for="firstName">First Name</label>
      <input type="text" id="firstName" placeholder="Enter your first name" autocomplete="off" required />

      <label for="lastName">Last Name</label>
      <input type="text" id="lastName" placeholder="Enter your last name" autocomplete="off" required />

      <label for="employeeId">Employee ID</label>
      <input type="text" id="employeeId" placeholder="Enter your employee ID" autocomplete="off" required />

      <label for="department">Department</label>
      <input type="text" id="department" placeholder="Enter your department" autocomplete="off" required />

      <button type="submit" class="btn">Submit</button>
    `;
  } else {
    additionalInfoFormContent.innerHTML = `
      <label for="firstName">First Name</label>
      <input type="text" id="firstName" placeholder="Enter your first name" autocomplete="off" required />

      <label for="lastName">Last Name</label>
      <input type="text" id="lastName" placeholder="Enter your last name" autocomplete="off" required />

      <label for="lrn">LRN</label>
      <input type="text" id="lrn" placeholder="Enter your LRN" autocomplete="off" required />

      <label for="grade">Grade</label>
      <input type="text" id="grade" placeholder="Enter your grade" autocomplete="off" required />

      <label for="section">Section</label>
      <input type="text" id="section" placeholder="Enter your section" autocomplete="off" required />

      <button type="submit" class="btn">Submit</button>
    `;
  }
}

function toggleLoading(show) {
  loadingIndicator.style.display = show ? "flex" : "none";
}

function handlePasswordResetComplete() {
  showNotification("You can now sign in with your new password.", "success");
  showSignInForm();
  forgotPasswordForm.reset();

  document.getElementById("reset-instructions").style.display = "none";
  document.getElementById("forgotPasswordForm").style.display = "block";
  document.getElementById("reset-completion").style.display = "none";
  document.getElementById("reset-message").textContent = "";
}

async function handleResendPasswordReset() {
  const email = document.getElementById("reset-email").value.trim();

  const now = Date.now();
  const lastSent = lastResetSentTime[email] || 0;
  const timeRemaining = RESET_COOLDOWN_MS - (now - lastSent);

  if (lastSent && timeRemaining > 0) {
    const minutesRemaining = Math.floor(timeRemaining / 60000);
    const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

    showNotification(
      `Please wait ${minutesRemaining}m ${secondsRemaining}s before requesting another reset link`,
      "warning"
    );
    return;
  }

  toggleLoading(true);

  try {
    const result = await sendPasswordReset(email);
    if (result.success) {
      lastResetSentTime[email] = Date.now();

      updateResendButtonCountdown(email);

      showNotification("Password reset email has been resent. Check your inbox.", "success");
    } else {
      showNotification("Error: " + result.error, "error");
    }
  } catch (error) {
    console.error("Resend error:", error);
    showNotification("An unexpected error occurred", "error");
  } finally {
    toggleLoading(false);
  }
}

function updateResendButtonCountdown(email) {
  const resendBtn = document.getElementById("resend-reset-btn");
  if (!resendBtn) return;

  resendBtn.disabled = true;

  const updateTimer = () => {
    const now = Date.now();
    const lastSent = lastResetSentTime[email] || 0;
    const timeRemaining = RESET_COOLDOWN_MS - (now - lastSent);

    if (timeRemaining <= 0) {
      resendBtn.textContent = "Resend Link";
      resendBtn.disabled = false;
      return;
    }

    const minutesRemaining = Math.floor(timeRemaining / 60000);
    const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
    resendBtn.textContent = `Resend Link (${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')})`;

    setTimeout(updateTimer, 1000);
  };

  updateTimer();
}

async function handleFormSubmission(event, formType) {
  event.preventDefault();
  toggleLoading(true);

  try {
    if (formType === "signIn") {
      const email = document.getElementById("signin-email").value.trim();
      const password = document.getElementById("signin-password").value.trim();

      const adminResult = await adminLogin(email, password);
      if (adminResult.success) {
        showNotification("Admin login successful", "success");
        window.location.href = adminResult.redirectUrl;
        return;
      }

      const userResult = await userLogin(email, password);
      if (userResult.success) {
        showNotification("Login successful", "success");
        window.location.href = "library.html";
      } else {
        showNotification(userResult.error || "Invalid credentials", "error");
      }

    } else if (formType === "signUp") {
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value.trim();
      // Get the selected userType and normalize to lowercase
      let userType = "";
      const userTypeInput = document.querySelector('input[name="userType"]:checked');
      if (userTypeInput) {
        userType = userTypeInput.value.trim().toLowerCase();
      }

      const result = await registerUser(email, password, userType);
      if (result.success) {
        showNotification("Registration started, please complete your profile", "success");
        showAdditionalInfoForm(result.user.uid);
      } else {
        showNotification("Error: " + result.error, "error");
      }

    } else if (formType === "additionalInfo") {
      const userId = localStorage.getItem("pendingUserId");
      let userType = localStorage.getItem("pendingUserType");
      userType = userType ? userType.toLowerCase() : "";
      const firstName = document.getElementById("firstName").value.trim();
      const lastName = document.getElementById("lastName").value.trim();

      let result;

      if (userType === "teacher") {
        const employeeId = document.getElementById("employeeId").value.trim();
        const department = document.getElementById("department").value.trim();

        result = await saveTeacherInfo(userId, firstName, lastName, employeeId, department);
      } else {
        const lrn = document.getElementById("lrn").value.trim();
        const grade = document.getElementById("grade").value.trim();
        const section = document.getElementById("section").value.trim();

        result = await saveStudentInfo(userId, firstName, lastName, lrn, grade, section);
      }

      if (result.success) {
        showNotification("Your account has been created and is pending approval", "info");

        localStorage.removeItem("pendingUserId");
        localStorage.removeItem("pendingUserType");

        setTimeout(() => {
          window.location.href = "index.html";
        }, 2000);
      } else {
        showNotification("Error: " + result.error, "error");
      }
    } else if (formType === "forgotPassword") {
      const email = document.getElementById("reset-email").value.trim();

      const now = Date.now();
      const lastSent = lastResetSentTime[email] || 0;
      const timeRemaining = RESET_COOLDOWN_MS - (now - lastSent);

      if (lastSent && timeRemaining > 0) {
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

        showNotification(
          `Please wait ${minutesRemaining}m ${secondsRemaining}s before requesting another reset link`,
          "warning"
        );
        toggleLoading(false);
        return;
      }

      const result = await sendPasswordReset(email);
      if (result.success) {
        lastResetSentTime[email] = Date.now();

        document.getElementById("reset-email-display").textContent = email;
        document.getElementById("reset-instructions").style.display = "block";
        document.getElementById("forgotPasswordForm").style.display = "none";
        document.getElementById("reset-completion").style.display = "block";
        showNotification("Password reset email sent. Check your inbox.", "success");

        updateResendButtonCountdown(email);
      } else {
        showNotification("Error: " + result.error, "error");
      }
    }
  } catch (error) {
    console.error("Unexpected error:", error.message);
    showNotification("An unexpected error occurred", "error");
  } finally {
    toggleLoading(false);
  }
}

async function handleGoogleSignIn() {
  toggleLoading(true);
  try {
    showNotification("Google Sign-In functionality not implemented yet", "warning");
    toggleLoading(false);
  } catch (error) {
    showNotification("Google sign-in failed", "error");
    toggleLoading(false);
  }
}

function showNotification(message, type = 'info') {
  notification.show(message, type, 5000);
}

document.addEventListener("DOMContentLoaded", async function () {
  notification.init();
  await initializeDefaultAccounts();
  handleUIEvents();
});