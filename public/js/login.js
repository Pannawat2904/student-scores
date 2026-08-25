document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const usernameInput = document.getElementById('username').value;
  const passwordInput = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const errorBox = document.getElementById('login-error');
  
  btn.disabled = true;
  btn.textContent = 'กำลังตรวจสอบ...';
  errorBox.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });

    if (res.ok) {
      window.location.href = '/admin.html';
    } else {
      errorBox.style.display = 'block';
    }
  } catch (err) {
    errorBox.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
    errorBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'เข้าสู่ระบบ';
  }
});
